import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readLabelWithVision } from "@/lib/vision";
import { extractText, extractCertNumber, parseLabelData } from "@/lib/ocr";
import { lookupCert, deriveManufacturer } from "@/lib/graders";
import { logTrainingExample } from "@/lib/training";

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

  // Two input modes:
  //  1. multipart/form-data with `image` file (direct upload from <input>)
  //  2. JSON body with `photoUrl` (server fetches it — used when the photo
  //     already lives on R2 and the browser can't cross-origin fetch it)
  let buffer: Buffer;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const { photoUrl } = await req.json();
    if (!photoUrl || typeof photoUrl !== "string") return NextResponse.json({ error: "photoUrl required." }, { status: 400 });
    try {
      const r = await fetch(photoUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      buffer = Buffer.from(await r.arrayBuffer());
    } catch (err) {
      return NextResponse.json({ error: `Could not fetch photo: ${String(err)}` }, { status: 400 });
    }
    if (buffer.length > 20 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 20 MB." }, { status: 400 });
  } else {
    const formData = await req.formData();
    const file     = formData.get("image") as File | null;
    if (!file)                           return NextResponse.json({ error: "No image provided." },           { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File must be an image." },       { status: 400 });
    if (file.size > 20 * 1024 * 1024)   return NextResponse.json({ error: "Image must be under 20 MB." }, { status: 400 });
    buffer = Buffer.from(await file.arrayBuffer());
  }

  // ── Path 1: Claude Vision (primary) ──────────────────────────────────────
  let visionLabel: Awaited<ReturnType<typeof readLabelWithVision>> | null = null;
  try {
    visionLabel = await readLabelWithVision(buffer);
  } catch {
    // Vision failed — fall back to OCR
  }

  // ── Path 2: PaddleOCR (fallback if Vision fails or returns nothing) ───────
  let ocrData: { detection: ReturnType<typeof extractCertNumber>; label: ReturnType<typeof parseLabelData> } | null = null;

  if (!visionLabel?.certNumber && !visionLabel?.player) {
    try {
      const rawText = await Promise.race([
        extractText(buffer),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("OCR_TIMEOUT")), OCR_TIMEOUT_MS)
        ),
      ]);
      const detection = extractCertNumber(rawText);
      const label     = parseLabelData(rawText);
      if (detection || label.year) ocrData = { detection, label };
    } catch {
      // OCR also failed
    }
  }

  // ── No usable data from either path ──────────────────────────────────────
  if (!visionLabel?.certNumber && !visionLabel?.player && !ocrData) {
    return NextResponse.json({
      success: false,
      error:   "Could not read the label. Try a closer photo or enter the cert number manually.",
    });
  }

  // ── Merge Vision + OCR results (Vision wins where it has data) ────────────
  const detection = visionLabel
    ? { certNumber: visionLabel.certNumber ?? "", grader: (visionLabel.grader ?? "Unknown") as ReturnType<typeof extractCertNumber>["grader"] }
    : ocrData?.detection ?? null;
  const label = visionLabel
    ? {
        player:          visionLabel.player       ?? null,
        year:            visionLabel.year          ?? null,
        manufacturer:    visionLabel.manufacturer  ?? null,
        set:             visionLabel.set           ?? null,
        subset:          visionLabel.subset        ?? null,
        cardNumber:      visionLabel.cardNumber    ?? null,
        grade:           visionLabel.grade         ?? null,
        bgsSubCentering: visionLabel.bgsSubCentering ?? null,
        bgsSubCorners:   visionLabel.bgsSubCorners   ?? null,
        bgsSubEdges:     visionLabel.bgsSubEdges     ?? null,
        bgsSubSurface:   visionLabel.bgsSubSurface   ?? null,
      }
    : ocrData?.label ?? { player: null, year: null, manufacturer: null, set: null, subset: null, cardNumber: null, grade: null, bgsSubCentering: null, bgsSubCorners: null, bgsSubEdges: null, bgsSubSurface: null };

  let apiData = null;
  if (detection?.grader === "PSA") {
    apiData = await lookupCert(detection.certNumber, "PSA").catch(() => null);
  }

  const cardData = {
    isGraded:        visionLabel ? visionLabel.isGraded : !!(detection?.certNumber),
    isAutographed:   visionLabel?.isAutographed ?? false,
    certNumber:      detection?.certNumber          ?? null,
    grader:          detection?.grader              ?? "Unknown",
    player:          apiData?.player   || label.player       || null,
    year:            apiData?.year     || label.year         || null,
    manufacturer:    resolveManufacturer(apiData?.manufacturer || label.manufacturer || null, apiData?.set || label.set || null),
    set:             apiData?.set      || label.set          || null,
    subset:          apiData?.subset   || label.subset       || null,
    cardNumber:      apiData?.cardNumber || label.cardNumber || null,
    grade:           apiData?.grade    || label.grade        || null,
    sport:           visionLabel?.sport || apiData?.sport    || null,
    bgsSubCentering: label.bgsSubCentering ?? null,
    bgsSubCorners:   label.bgsSubCorners   ?? null,
    bgsSubEdges:     label.bgsSubEdges     ?? null,
    bgsSubSurface:   label.bgsSubSurface   ?? null,
  };

  // Log training example (non-blocking, respects user consent)
  void logTrainingExample(buffer, {
    source:       "scan",
    grader:       cardData.grader       ?? undefined,
    certNumber:   cardData.certNumber   ?? undefined,
    player:       cardData.player       ?? undefined,
    year:         cardData.year         ?? undefined,
    manufacturer: cardData.manufacturer ?? undefined,
    set:          cardData.set          ?? undefined,
    subset:       cardData.subset       ?? undefined,
    cardNumber:   cardData.cardNumber   ?? undefined,
    grade:        cardData.grade        ?? undefined,
  }, session.user.id);

  return NextResponse.json({
    success:    true,
    certNumber: cardData.certNumber,
    grader:     cardData.grader,
    source:     apiData ? (visionLabel ? "api+vision" : "api+ocr") : (visionLabel ? "vision" : "ocr"),
    cardData: {
      isGraded:        cardData.isGraded,
      isAutographed:   cardData.isAutographed,
      certNumber:      cardData.certNumber,
      grader:          cardData.grader,
      player:          cardData.player,
      year:            cardData.year,
      manufacturer:    cardData.manufacturer,
      set:             cardData.set,
      subset:          cardData.subset,
      cardNumber:      cardData.cardNumber,
      grade:           cardData.grade,
      sport:           cardData.sport,
      bgsSubCentering: cardData.bgsSubCentering,
      bgsSubCorners:   cardData.bgsSubCorners,
      bgsSubEdges:     cardData.bgsSubEdges,
      bgsSubSurface:   cardData.bgsSubSurface,
    },
  });
}
