import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractText, extractCertNumber, parseLabelData } from "@/lib/ocr";
import { lookupCert } from "@/lib/graders";

const OCR_TIMEOUT_MS = 120_000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file     = formData.get("image") as File | null;

  if (!file)                           return NextResponse.json({ error: "No image provided." },          { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File must be an image." },      { status: 400 });
  if (file.size > 20 * 1024 * 1024)   return NextResponse.json({ error: "Image must be under 20 MB." }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // OCR the image
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
          ? "OCR timed out. Try again in a moment, or enter the cert number manually."
          : "OCR failed. Try a clearer photo or enter the cert number manually.",
      });
    }

    // Extract cert number — if not found, return the label parse anyway
    const detection  = extractCertNumber(rawText);
    const labelData  = parseLabelData(rawText);

    if (!detection && !labelData.player && !labelData.year) {
      return NextResponse.json({
        success: false,
        error:   "Could not read the label. Try a clearer close-up, or enter the cert number manually.",
        rawText,
      });
    }

    // PSA: enrich with API data (we have a working token).
    // All other graders: label parsing is the sole source — no API exists.
    let apiData = null;
    if (detection?.grader === "PSA") {
      apiData = await lookupCert(detection.certNumber, "PSA").catch(() => null);
    }

    // Merge: API data takes precedence over label parse where both exist
    const cardData = {
      certNumber:   detection?.certNumber          ?? null,
      grader:       detection?.grader              ?? "Unknown",
      player:       apiData?.player   || labelData.player       || null,
      year:         apiData?.year     || labelData.year         || null,
      manufacturer: apiData?.manufacturer || labelData.manufacturer || null,
      set:          apiData?.set      || labelData.set          || null,
      subset:       apiData?.subset   || labelData.subset       || null,
      cardNumber:   apiData?.cardNumber || labelData.cardNumber || null,
      grade:        apiData?.grade    || labelData.grade        || null,
      sport:        apiData?.sport                              || null,
    };

    return NextResponse.json({
      success:    true,
      certNumber: detection?.certNumber ?? null,
      grader:     detection?.grader     ?? "Unknown",
      cardData,
      source:     apiData ? "api+label" : "label",
      rawText,
    });

  } catch (err) {
    console.error("[/api/scan]", err);
    return NextResponse.json({ error: "Scan failed. Please try again." }, { status: 500 });
  }
}
