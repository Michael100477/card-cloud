import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractText, extractCertNumber } from "@/lib/ocr";
import { lookupCert } from "@/lib/graders";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file     = formData.get("image") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 20 MB." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Step 1: OCR — extract all text from the slab label
    const rawText = await extractText(buffer);

    // Step 2: Find the cert number and identify the grader
    const detection = extractCertNumber(rawText);

    if (!detection) {
      return NextResponse.json({
        success: false,
        error:   "No cert number found. Try a clearer photo of the label.",
        rawText,
      });
    }

    // Step 3: Look up card details from the grader's API
    const cardData = await lookupCert(detection.certNumber, detection.grader);

    return NextResponse.json({
      success:    true,
      certNumber: detection.certNumber,
      grader:     detection.grader,
      cardData,
      rawText,    // included so the UI can show what OCR read
    });
  } catch (err) {
    console.error("[/api/scan]", err);
    return NextResponse.json(
      { error: "Scan failed. Please try again with a clearer photo." },
      { status: 500 }
    );
  }
}
