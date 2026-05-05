import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readLabelWithVision } from "@/lib/vision";
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

  if (!file)                           return NextResponse.json({ error: "No image provided." },           { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File must be an image." },       { status: 400 });
  if (file.size > 20 * 1024 * 1024)   return NextResponse.json({ error: "Image must be under 20 MB." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  // ── Path 1: Claude Vision (ANTHROPIC_API_KEY set) ─────────────────────────
  // Much more reliable than OCR — reads the label like a human would.
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const visionResult = await readLabelWithVision(buffer);

      if (visionResult && (visionResult.certNumber || visionResult.year)) {
        // PSA: enrich further with API data where available
        let apiData = null;
        if (visionResult.certNumber && visionResult.grader === "PSA") {
          apiData = await lookupCert(visionResult.certNumber, "PSA").catch(() => null);
        }

        const cardData = {
          certNumber:   visionResult.certNumber,
          grader:       visionResult.grader,
          player:       apiData?.player       || visionResult.player       || null,
          year:         apiData?.year         || visionResult.year         || null,
          manufacturer: apiData?.manufacturer || visionResult.manufacturer || null,
          set:          apiData?.set          || visionResult.set          || null,
          subset:       apiData?.subset       || visionResult.subset       || null,
          cardNumber:   apiData?.cardNumber   || visionResult.cardNumber   || null,
          grade:        apiData?.grade        || visionResult.grade        || null,
          sport:        apiData?.sport        || visionResult.sport        || null,
        };

        return NextResponse.json({
          success: true,
          certNumber: visionResult.certNumber,
          grader:     visionResult.grader,
          cardData,
          source:     "vision",
        });
      }
    } catch (err) {
      console.error("[scan vision]", err);
      // Fall through to OCR
    }
  }

  // ── Path 2: Tesseract OCR (fallback when no Anthropic key) ───────────────
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
        ? "Scan timed out. Enter the cert number manually — it's faster."
        : "Scan failed. Try entering the cert number manually.",
    });
  }

  const detection = extractCertNumber(rawText);
  const labelData = parseLabelData(rawText);

  if (!detection && !labelData.year) {
    return NextResponse.json({
      success: false,
      error:   "Could not read the label. Try a closer photo of just the label, or enter the cert number manually.",
      rawText,
    });
  }

  let apiData = null;
  if (detection?.grader === "PSA") {
    apiData = await lookupCert(detection.certNumber, "PSA").catch(() => null);
  }

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
    source:     apiData ? "api+ocr" : "ocr",
    rawText,
  });
}
