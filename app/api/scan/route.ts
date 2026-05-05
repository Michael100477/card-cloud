import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractText, extractCertNumber } from "@/lib/ocr";
import { lookupCert } from "@/lib/graders";

const OCR_TIMEOUT_MS = 30_000; // 30 s — first run downloads language data

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file     = formData.get("image") as File | null;

  if (!file)                         return NextResponse.json({ error: "No image provided." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 20 MB." }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // OCR with timeout — first run downloads the ~4 MB Tesseract eng model
    let rawText: string;
    try {
      rawText = await Promise.race([
        extractText(buffer),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("OCR_TIMEOUT")), OCR_TIMEOUT_MS)
        ),
      ]);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === "OCR_TIMEOUT";
      return NextResponse.json({
        success: false,
        error: isTimeout
          ? "OCR timed out. The language model may still be downloading — try again in a moment, or enter the cert number manually."
          : "OCR failed. Try a clearer photo or enter the cert number manually.",
      });
    }

    const detection = extractCertNumber(rawText);
    if (!detection) {
      return NextResponse.json({
        success: false,
        error: "No cert number found. Try a clearer close-up of the label, or enter the cert number manually.",
        rawText,
      });
    }

    const cardData = await lookupCert(detection.certNumber, detection.grader);
    return NextResponse.json({ success: true, certNumber: detection.certNumber, grader: detection.grader, cardData, rawText });

  } catch (err) {
    console.error("[/api/scan]", err);
    return NextResponse.json({ error: "Scan failed. Please try again." }, { status: 500 });
  }
}
