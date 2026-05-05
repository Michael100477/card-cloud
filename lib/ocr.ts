/**
 * OCR pipeline for slab label reading.
 *
 * Strategy: label-area crops first (focused, high-res text), full image fallback.
 * tesseract.js runs in a child process to avoid Next.js module resolution issues.
 */

import sharp from "sharp";
import { spawn } from "child_process";
import path from "path";

// ─── Image prep ───────────────────────────────────────────────────────────────

async function enhanceForOCR(imgBuf: Buffer): Promise<Buffer> {
  const meta = await sharp(imgBuf).metadata();
  const w = meta.width ?? 800;

  // Upscale aggressively if the crop is small so text is at least ~20px tall
  const targetWidth = Math.max(1200, w * 2);

  return sharp(imgBuf)
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1 })                                          // gentle sharpen
    .resize({ width: targetWidth, withoutEnlargement: false })
    .png()
    .toBuffer();
}

/**
 * Build candidate label crops from smallest (most focused) to largest.
 * Slab labels are typically 8-20% of the slab's short edge.
 * We try multiple sizes so we don't miss labels at various zoom levels.
 * No EXIF auto-rotate — work with the image exactly as the user photographed it.
 */
async function labelCrops(imageBuffer: Buffer): Promise<Buffer[]> {
  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width  ?? 1200;
  const h = meta.height ?? 1600;

  const crops: Buffer[] = [];

  if (h >= w) {
    // Portrait — try multiple top-slice percentages (small → large)
    for (const pct of [0.10, 0.15, 0.20, 0.28]) {
      const sliceH = Math.floor(h * pct);
      crops.push(await sharp(imageBuffer).extract({ left: 0, top: 0, width: w, height: sliceH }).toBuffer());
    }
    // Also try bottom slices (label could be at the bottom for some slabs)
    for (const pct of [0.12, 0.18]) {
      const sliceH = Math.floor(h * pct);
      crops.push(await sharp(imageBuffer).extract({ left: 0, top: h - sliceH, width: w, height: sliceH }).toBuffer());
    }
  } else {
    // Landscape — label on left or right edge, try both with rotation
    for (const pct of [0.12, 0.18, 0.25]) {
      const sliceW = Math.floor(w * pct);
      crops.push(await sharp(imageBuffer).extract({ left: 0,        top: 0, width: sliceW, height: h }).rotate(90).toBuffer());
      crops.push(await sharp(imageBuffer).extract({ left: w-sliceW, top: 0, width: sliceW, height: h }).rotate(-90).toBuffer());
    }
  }

  // Full image last resort
  crops.push(
    await sharp(imageBuffer)
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: false })
      .toBuffer()
  );

  return crops;
}

// ─── OCR child process ────────────────────────────────────────────────────────

function projectRoot(): string {
  return process.env.PROJECT_ROOT ?? process.cwd();
}

async function runOCR(imageBuffer: Buffer): Promise<string> {
  const root       = projectRoot();
  const workerPath = path.join(root, "scripts", "ocr-worker.mjs");
  const base64     = imageBuffer.toString("base64");

  return new Promise((resolve, reject) => {
    const child = spawn("node", [workerPath], {
      cwd:   root,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (stderr) console.warn("[ocr-worker stderr]", stderr.slice(0, 300));
      try {
        const result = JSON.parse(stdout);
        if (result.error) reject(new Error(result.error));
        else resolve(result.text ?? "");
      } catch {
        console.error("[ocr-worker] bad output:", stdout.slice(0, 200));
        reject(new Error(`OCR worker exited (${code}): ${stdout.slice(0, 100)}`));
      }
    });

    child.on("error", (err) => { console.error("[ocr-worker spawn]", err); reject(err); });
    child.stdin.write(base64);
    child.stdin.end();
  });
}

// ─── Public: extract text ─────────────────────────────────────────────────────

export async function extractText(imageBuffer: Buffer): Promise<string> {
  const crops = await labelCrops(imageBuffer);
  let lastText = "";

  for (let i = 0; i < crops.length; i++) {
    try {
      const enhanced = await enhanceForOCR(crops[i]);
      const text     = await runOCR(enhanced);
      lastText = text;

      // Accept this crop as soon as it contains a plausible cert number
      if (/\d{7,10}/.test(text)) {
        if (i > 0) console.log(`[OCR] cert found in crop ${i}`);
        return text;
      }
    } catch (err) {
      console.warn(`[OCR] crop ${i} failed:`, err);
    }
  }

  return lastText;
}

// ─── Cert number extraction ───────────────────────────────────────────────────

export interface CertDetection {
  certNumber: string;
  grader: "PSA" | "BGS" | "BGGS" | "SGC" | "CGC" | "Unknown";
}

export function extractCertNumber(ocrText: string): CertDetection | null {
  const text = ocrText.replace(/\s+/g, " ").toUpperCase();

  // BGS/BGGS detection — the Beckett "B" logo is a clear watermark that OCR
  // often can't read. Detect by BGS-specific subgrade keywords instead.
  const hasBGSSubgrades =
    text.includes("CENTERING") && text.includes("CORNERS") &&
    text.includes("EDGES")     && text.includes("SURFACE");

  if (hasBGSSubgrades && (text.includes("BGGS") || text.includes("GOLD LABEL"))) {
    const m = text.match(/(\d{10})(?!\d)/);
    if (m) return { certNumber: m[1], grader: "BGGS" };
  }
  if (hasBGSSubgrades || text.includes("BECKETT")) {
    const m = text.match(/(\d{10})(?!\d)/);
    if (m) return { certNumber: m[1], grader: "BGS" };
  }
  if (text.includes("PSA")) {
    const m = text.match(/(\d{7,9})(?!\d)/);
    if (m) return { certNumber: m[1], grader: "PSA" };
  }
  if (text.includes("SGC")) {
    const m = text.match(/(\d{8})(?!\d)/);
    if (m) return { certNumber: m[1], grader: "SGC" };
  }
  if (text.includes("CGC")) {
    const m = text.match(/(\d{10})(?!\d)/);
    if (m) return { certNumber: m[1], grader: "CGC" };
  }

  // Length-based fallback
  const ten  = text.match(/\b(\d{10})\b/);   if (ten)  return { certNumber: ten[1],   grader: "BGS" };
  const nine = text.match(/\b(\d{7,9})\b/);  if (nine) return { certNumber: nine[1],  grader: "PSA" };
  const eight = text.match(/\b(\d{8})\b/);   if (eight) return { certNumber: eight[1], grader: "SGC" };

  return null;
}

// ─── Label text parser ────────────────────────────────────────────────────────

export interface LabelData {
  player:       string | null;
  year:         number | null;
  manufacturer: string | null;
  set:          string | null;
  subset:       string | null;
  cardNumber:   string | null;
  grade:        string | null;
}

function tc(s: string): string {
  return s.toLowerCase().replace(/\b(\w)/g, c => c.toUpperCase());
}

const BRAND_KEYWORDS = new Set([
  "TOPPS","BOWMAN","PANINI","PRIZM","SELECT","DONRUSS","SCORE","OPTIC",
  "UPPER DECK","FLEER","LEAF","STADIUM CLUB","FINEST","HERITAGE","CHROME",
  "MOSAIC","CONTENDERS","CHRONICLES","NATIONAL TREASURES","IMMACULATE",
  "SIGNATURE SERIES","SP","SPX","O-PEE-CHEE","PACIFIC",
]);

const NOT_A_NAME = new Set([
  "PSA","BGS","BGGS","SGC","CGC","HGA","GEM","MINT","NEAR","AUTHENTIC",
  "PROOF","GOLD","SILVER","BRONZE","REFRACTOR","PARALLEL","AUTO","JERSEY",
  "PATCH","ROOKIE","CARD","FOIL","HOLO","PRIZM","CHROME","STARS","SPECTRUM",
  "CENTERING","CORNERS","EDGES","SURFACE",
]);

function deriveManufacturerLocal(brand: string): string | null {
  const b = brand.toUpperCase();
  if (/\bTOPPS\b|\bBOWMAN\b|\bSTADIUM CLUB\b|\bFINEST\b|\bHERITAGE\b/.test(b)) return "Topps";
  if (/\bPANINI\b|\bPRIZM\b|\bSELECT\b|\bDONRUSS\b|\bSCORE\b|\bOPTIC\b|\bMOSAIC\b/.test(b)) return "Panini";
  if (/\bUPPER DECK\b|\bSPX?\b|\bO-PEE-CHEE\b/.test(b)) return "Upper Deck";
  if (/\bFLEER\b|\bULTRA\b/.test(b)) return "Fleer";
  return null;
}

export function parseLabelData(ocrText: string): LabelData {
  const raw   = ocrText;
  const upper = raw.toUpperCase();
  const lines = raw.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 1);

  const result: LabelData = {
    player: null, year: null, manufacturer: null,
    set: null, subset: null, cardNumber: null, grade: null,
  };

  // ── Year ──────────────────────────────────────────────────────────────────
  const yearM = upper.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/);
  if (yearM) result.year = parseInt(yearM[1]);

  // ── Card number ───────────────────────────────────────────────────────────
  const cnM = upper.match(/#\s*([A-Z0-9]{1,8})(?:\s|$)/);
  if (cnM) result.cardNumber = cnM[1];

  // ── Grade ─────────────────────────────────────────────────────────────────
  const gradePatterns = [
    /\bGEM[\s-]*MT\s+(\d+)/i, /\bNM[\s-]*MT\s+(\d+)/i,
    /\bMINT\s+(\d+(?:\.\d+)?)/i, /\bEX[\s-]*MT\s+(\d+)/i,
    /\b(?:BGS|SGC|CGC|HGA)\s+(\d+(?:\.\d+)?)/i,
    /(?:GEM|MINT|NM|EX|VG|GOOD|FAIR|POOR|AUTHENTIC)[^\d]*(\d+(?:\.\d+)?)/i,
  ];
  for (const p of gradePatterns) {
    const m = raw.match(p);
    if (m) { result.grade = m[1]; break; }
  }

  // ── Year + Brand (line 1 of label) ───────────────────────────────────────
  let yearLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(19\d{2}|20\d{2})\s+(.{2,40})$/i);
    if (m) {
      result.year = parseInt(m[1]);
      const brandStr = m[2].trim().replace(/#.*$/, "").trim();
      if (brandStr.length > 1) {
        result.manufacturer = deriveManufacturerLocal(brandStr) ?? tc(brandStr);
        result.set = tc(brandStr);
      }
      yearLineIdx = i;
      break;
    }
  }

  // ── BGS line 2: specific set name (e.g. "'87 Topps Silver Pack Chrome") ──
  if (yearLineIdx >= 0 && yearLineIdx + 1 < lines.length) {
    const next = lines[yearLineIdx + 1].trim();
    if (next && !next.startsWith("#") && !/^\d/.test(next)) {
      const notGrade = !/CENTERING|CORNERS|EDGES|SURFACE|GEM|MINT/.test(next.toUpperCase());
      if (notGrade) {
        result.set = tc(next);
        const d = deriveManufacturerLocal(next);
        if (d) result.manufacturer = d;
      }
    }
  }

  // ── BGS combined line: "#87BJ BO JACKSON" → cardNumber + player ──────────
  for (const line of lines) {
    const m = line.match(/^#([A-Z0-9]+)\s+([A-Z][A-Z\s\-'.]{3,30})$/i);
    if (m) {
      if (!result.cardNumber) result.cardNumber = m[1];
      if (!result.player)    result.player    = tc(m[2].trim());
      break;
    }
  }

  // ── Player name (standalone all-caps line) ────────────────────────────────
  // Require at least 3 chars per word to filter out OCR noise like "Li Ze Bn Ih"
  if (!result.player) {
    for (const line of lines) {
      const words = line.trim().toUpperCase().split(/\s+/);
      const ok =
        words.length >= 2 && words.length <= 4 &&
        words.every(w => /^[A-Z\-'.]{3,}$/.test(w)) &&  // ← 3+ chars, not 2+
        !words.some(w => NOT_A_NAME.has(w)) &&
        !line.match(/\d/) &&
        line.trim().length >= 7; // full name must be at least 7 chars total
      if (ok) { result.player = tc(line.trim()); break; }
    }
  }

  // ── Subset ────────────────────────────────────────────────────────────────
  const subsetRe = [
    /ARTIST['']S\s+PROOF/i, /FUTURE\s+STARS/i, /ROOKIE\s+CARD/i,
    /SILVER\s+PACK/i, /REFRACTOR/i, /GOLD\s+REFRACTOR/i,
    /AUTO(?:GRAPH)?/i, /JERSEY/i, /PATCH/i, /PARALLEL/i, /HOLO/i,
    /(?:BLUE|RED|GREEN|PURPLE|ORANGE|YELLOW|PINK|BLACK|WHITE)\s+(?:PARALLEL|REFRACTOR|PRIZM)/i,
  ];
  for (const p of subsetRe) {
    const m = raw.match(p);
    if (m) { result.subset = tc(m[0]); break; }
  }

  return result;
}

// Detect grader from cert number format (manual entry)
export function detectGraderFromCert(certNumber: string): CertDetection["grader"] {
  const n = certNumber.replace(/\D/g, "");
  if (n.length === 10) return "BGS";
  if (n.length >= 7 && n.length <= 9) return "PSA";
  return "Unknown";
}
