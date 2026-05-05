import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readLabelWithVision } from "@/lib/vision";
import { extractText, extractCertNumber, parseLabelData } from "@/lib/ocr";
import { lookupCert, deriveManufacturer } from "@/lib/graders";

// If manufacturer is null but we have a set name, try to derive the parent company.
// e.g. set="Topps" → manufacturer="Topps", set="Bowman Chrome" → manufacturer="Topps"
function resolveManufacturer(manufacturer: string | null, set: string | null): string | null {
  if (manufacturer) return manufacturer;
  if (!set) return null;
  return deriveManufacturer(set) ?? set; // fall back to set name itself if unknown
}

const OCR_TIMEOUT_MS = 60_000;

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

  // ── Path 1: Tesseract OCR (free, try first) ───────────────────────────────
  let ocrData: { detection: ReturnType<typeof extractCertNumber>; label: ReturnType<typeof parseLabelData> } | null = null;

  try {
    const rawText = await Promise.race([
      extractText(buffer),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("OCR_TIMEOUT")), OCR_TIMEOUT_MS)
      ),
    ]);

    const detection = extractCertNumber(rawText);
    const label     = parseLabelData(rawText);

    // OCR succeeded if it found a cert number OR a year — not just noise
    if (detection || label.year) {
      ocrData = { detection, label };
    }
  } catch {
    // OCR timed out or failed — fall through to vision
  }

  // ── Path 2: Claude Vision (only if OCR failed) ────────────────────────────
  if (!ocrData && process.env.ANTHROPIC_API_KEY) {
    try {
      const visionResult = await readLabelWithVision(buffer);

      if (visionResult && (visionResult.certNumber || visionResult.year)) {
        let apiData = null;
        if (visionResult.certNumber && visionResult.grader === "PSA") {
          apiData = await lookupCert(visionResult.certNumber, "PSA").catch(() => null);
        }

        return NextResponse.json({
          success: true,
          certNumber: visionResult.certNumber,
          grader:     visionResult.grader,
          source:     "vision",
          cardData: {
            certNumber:      visionResult.certNumber,
            grader:          visionResult.grader,
            player:          apiData?.player       || visionResult.player       || null,
            year:            apiData?.year         || visionResult.year         || null,
            manufacturer:    resolveManufacturer(apiData?.manufacturer || visionResult.manufacturer || null, apiData?.set || visionResult.set || null),
            set:             apiData?.set          || visionResult.set          || null,
            subset:          apiData?.subset       || visionResult.subset       || null,
            cardNumber:      apiData?.cardNumber   || visionResult.cardNumber   || null,
            grade:           apiData?.grade        || visionResult.grade        || null,
            sport:           apiData?.sport        || visionResult.sport        || null,
            bgsSubCentering: visionResult.bgsSubCentering ?? null,
            bgsSubCorners:   visionResult.bgsSubCorners   ?? null,
            bgsSubEdges:     visionResult.bgsSubEdges     ?? null,
            bgsSubSurface:   visionResult.bgsSubSurface   ?? null,
          },
        });
      }
    } catch (err) {
      console.error("[scan vision]", err);
    }
  }

  // ── No usable data from either path ──────────────────────────────────────
  if (!ocrData) {
    return NextResponse.json({
      success: false,
      error:   "Could not read the label. Try a closer photo or enter the cert number manually.",
    });
  }

  // ── OCR succeeded — build response ────────────────────────────────────────
  const { detection, label } = ocrData;

  let apiData = null;
  if (detection?.grader === "PSA") {
    apiData = await lookupCert(detection.certNumber, "PSA").catch(() => null);
  }

  return NextResponse.json({
    success:    true,
    certNumber: detection?.certNumber ?? null,
    grader:     detection?.grader     ?? "Unknown",
    source:     apiData ? "api+ocr" : "ocr",
    cardData: {
      certNumber:      detection?.certNumber          ?? null,
      grader:          detection?.grader              ?? "Unknown",
      player:          apiData?.player   || label.player       || null,
      year:            apiData?.year     || label.year         || null,
      manufacturer:    resolveManufacturer(apiData?.manufacturer || label.manufacturer || null, apiData?.set || label.set || null),
      set:             apiData?.set      || label.set          || null,
      subset:          apiData?.subset   || label.subset       || null,
      cardNumber:      apiData?.cardNumber || label.cardNumber || null,
      grade:           apiData?.grade    || label.grade        || null,
      sport:           apiData?.sport                         || null,
      bgsSubCentering: label.bgsSubCentering ?? null,
      bgsSubCorners:   label.bgsSubCorners   ?? null,
      bgsSubEdges:     label.bgsSubEdges     ?? null,
      bgsSubSurface:   label.bgsSubSurface   ?? null,
    },
  });
}
