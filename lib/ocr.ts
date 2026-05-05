/**
 * OCR pipeline for slab label reading.
 *
 * tesseract.js breaks inside Next.js's bundler because its internal worker
 * script path resolves to the wrong directory under PM2.
 * Fix: spawn scripts/ocr-worker.mjs as a plain Node.js child process.
 * Image passed via stdin to avoid Windows 32,767-char CLI arg limit.
 */

import sharp from "sharp";
import { spawn } from "child_process";
import path from "path";

// ─── Preprocessing ────────────────────────────────────────────────────────────

async function prepareImage(imageBuffer: Buffer, rotateDeg = 0): Promise<Buffer> {
  return sharp(imageBuffer)
    .rotate()                                 // 1. auto-rotate using EXIF orientation
    .rotate(rotateDeg)                        // 2. explicit additional rotation
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.5 })
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
}

// ─── OCR via child process ────────────────────────────────────────────────────

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
// Tries the full image at 4 rotations (0°, 90°, 180°, 270°).
// This handles any photo orientation and any label position — the cert
// number will be in the image somewhere regardless of how the slab is held.

export async function extractText(imageBuffer: Buffer): Promise<string> {
  const rotations = [0, 90, 180, 270];
  let lastText = "";

  for (const deg of rotations) {
    try {
      const processed = await prepareImage(imageBuffer, deg);
      const text      = await runOCR(processed);
      lastText = text;

      // A valid cert number is 7–10 consecutive digits — stop as soon as found
      if (/\d{7,10}/.test(text)) {
        if (deg !== 0) console.log(`[OCR] cert found at +${deg}° rotation`);
        return text;
      }
    } catch (err) {
      console.warn(`[OCR] rotation ${deg}° failed:`, err);
    }
  }

  // No rotation yielded a cert — return last text for debug display
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
  // often can't read. Instead, detect by BGS-specific subgrade keywords.
  // Every BGS label shows CENTERING, CORNERS, EDGES, SURFACE.
  const hasBGSSubgrades =
    text.includes("CENTERING") && text.includes("CORNERS") &&
    text.includes("EDGES")     && text.includes("SURFACE");

  // BGGS (Beckett Gold) — has same subgrades, check for GOLD label text
  if (hasBGSSubgrades && (text.includes("BGGS") || text.includes("GOLD LABEL"))) {
    const m = text.match(/(\d{10})(?!\d)/);
    if (m) return { certNumber: m[1], grader: "BGGS" };
  }

  // BGS — detected via subgrades OR explicit "BGS" text
  if (hasBGSSubgrades || text.includes("BECKETT")) {
    const m = text.match(/(\d{10})(?!\d)/);
    if (m) return { certNumber: m[1], grader: "BGS" };
  }

  // PSA — explicit label text OR 7–9 digit cert
  if (text.includes("PSA")) {
    const m = text.match(/(\d{7,9})(?!\d)/);
    if (m) return { certNumber: m[1], grader: "PSA" };
  }

  // SGC — explicit label text OR 8-digit cert near "SGC"
  if (text.includes("SGC")) {
    const m = text.match(/(\d{8})(?!\d)/);
    if (m) return { certNumber: m[1], grader: "SGC" };
  }

  // CGC — explicit label text
  if (text.includes("CGC")) {
    const m = text.match(/(\d{10})(?!\d)/);
    if (m) return { certNumber: m[1], grader: "CGC" };
  }

  // Fallback: infer grader from cert number length
  const ten  = text.match(/\b(\d{10})\b/);   if (ten)  return { certNumber: ten[1],  grader: "BGS" };
  const nine = text.match(/\b(\d{7,9})\b/);  if (nine) return { certNumber: nine[1], grader: "PSA" };
  const eight = text.match(/\b(\d{8})\b/);   if (eight) return { certNumber: eight[1], grader: "SGC" };

  return null;
}

// ─── Label text parser ────────────────────────────────────────────────────────
// Extracts card details directly from the OCR text — works for any grader,
// no API credentials required.

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

// Brands whose name on the label IS the set (manufacturer is derived separately)
const BRAND_KEYWORDS = new Set([
  "TOPPS","BOWMAN","PANINI","PRIZM","SELECT","DONRUSS","SCORE","OPTIC",
  "UPPER DECK","FLEER","LEAF","STADIUM CLUB","FINEST","HERITAGE","CHROME",
  "MOSAIC","CONTENDERS","CHRONICLES","NATIONAL TREASURES","IMMACULATE",
  "SIGNATURE SERIES","SP","SPX","O-PEE-CHEE","PACIFIC","SCORE",
]);

// Words that are grading/meta terms, not player names
const NOT_A_NAME = new Set([
  "PSA","BGS","BGGS","SGC","CGC","HGA","GEM","MINT","NEAR","AUTHENTIC",
  "PROOF","GOLD","SILVER","BRONZE","REFRACTOR","PARALLEL","AUTO","JERSEY",
  "PATCH","ROOKIE","CARD","FOIL","HOLO","PRIZM","CHROME","STARS","SPECTRUM",
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

  // ── BGS-specific: extract subgrades (CENTERING / CORNERS / EDGES / SURFACE) ─
  // These appear on every BGS label. Parsing them now so they don't confuse
  // the player-name detector (the numbers look like they could be grades).
  const subgradeNums: number[] = [];
  const centeringM = upper.match(/CENTERING\s+(\d+(?:\.\d+)?)/);
  if (centeringM) subgradeNums.push(parseFloat(centeringM[1]));
  const cornersM   = upper.match(/CORNERS\s+(\d+(?:\.\d+)?)/);
  if (cornersM)   subgradeNums.push(parseFloat(cornersM[1]));
  // (edges + surface tracked but not stored — overall grade is what matters)

  // ── Year ────────────────────────────────────────────────────────────────────
  const yearM = upper.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/);
  if (yearM) result.year = parseInt(yearM[1]);

  // ── Card number (#170, No.170, etc.) ────────────────────────────────────────
  const cnM = upper.match(/#\s*([A-Z0-9]{1,6})(?:\s|$)/);
  if (cnM) result.cardNumber = cnM[1];

  // ── Grade ────────────────────────────────────────────────────────────────────
  // Grade descriptions like "GEM MT 10", "NM-MT 8", "MINT 9", "BGS 9.5"
  const gradePatterns = [
    /\bGEM[\s-]*MT\s+(\d+)/i,
    /\bNM[\s-]*MT\s+(\d+)/i,
    /\bNEAR\s+MINT[\s-]*MINT\s+(\d+)/i,
    /\bMINT[\s+](\d+(?:\.\d+)?)/i,
    /\bEX[\s-]*MT\s+(\d+)/i,
    /\bVG[\s-]*EX\s+(\d+)/i,
    /\b(?:BGS|SGC|CGC|HGA)\s+(\d+(?:\.\d+)?)/i,
    // Grade number on its own on a line after a grade word
    /(?:GEM|MINT|NM|EX|VG|GOOD|FAIR|POOR|AUTHENTIC)[^\d]*(\d+(?:\.\d+)?)/i,
  ];
  for (const p of gradePatterns) {
    const m = raw.match(p);
    if (m) { result.grade = m[1]; break; }
  }

  // ── Year + Set/Manufacturer from a line that starts with the year ───────────
  // e.g. "1987 TOPPS", "2021 BOWMAN CHROME", "2017 TOPPS"
  // BGS labels: line 1 = "YEAR BRAND", line 2 = specific set name
  let yearLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(19\d{2}|20\d{2})\s+(.{2,40})$/i);
    if (m) {
      result.year = parseInt(m[1]);
      const brandStr = m[2].trim().replace(/#.*$/, "").trim();
      if (brandStr.length > 1) {
        result.manufacturer = deriveManufacturerLocal(brandStr) ?? tc(brandStr);
        // For PSA-style labels the brand IS the set; for BGS the next line has the set
        result.set = tc(brandStr);
      }
      yearLineIndex = i;
      break;
    }
  }

  // BGS line 2: specific set name (e.g. "'87 TOPPS SILVER PACK CHROME")
  // This overrides the brand-as-set when available
  if (yearLineIndex >= 0 && yearLineIndex + 1 < lines.length) {
    const nextLine = lines[yearLineIndex + 1].trim();
    // It's a set name if it doesn't start with # and isn't a player name format
    if (nextLine && !nextLine.startsWith("#") && !/^\d/.test(nextLine)) {
      const nextUpper = nextLine.toUpperCase();
      const isGradeLine = /CENTERING|CORNERS|EDGES|SURFACE|GEM|MINT/.test(nextUpper);
      if (!isGradeLine) {
        result.set = tc(nextLine);
        // Derive manufacturer from this more specific line if not already set
        const derivedMfr = deriveManufacturerLocal(nextLine);
        if (derivedMfr) result.manufacturer = derivedMfr;
      }
    }
  }

  // ── BGS combined line: "#87BJ BO JACKSON" → cardNumber + player ─────────────
  // BGS labels put the card number and player name on the same line.
  // Format: #ALPHANUMERIC FIRSTNAME LASTNAME  (e.g. "#87BJ BO JACKSON")
  if (!result.cardNumber || !result.player) {
    for (const line of lines) {
      const bgsLine = line.match(/^#([A-Z0-9]+)\s+([A-Z][A-Z\s\-'\.]{3,30})$/i);
      if (bgsLine) {
        if (!result.cardNumber) result.cardNumber = bgsLine[1];
        if (!result.player) result.player = tc(bgsLine[2].trim());
        break;
      }
    }
  }

  // ── Player name ──────────────────────────────────────────────────────────────
  // Look for an all-caps line of 2-4 words that looks like a name.
  // Skip lines that contain brand/grading keywords.
  if (!result.player) {
    for (const line of lines) {
      const words = line.trim().toUpperCase().split(/\s+/);
      const isName =
        words.length >= 2 &&
        words.length <= 4 &&
        words.every(w => /^[A-Z\-'\.]{2,}$/.test(w)) &&
        !words.some(w => NOT_A_NAME.has(w)) &&
        !line.match(/\d/);
      if (isName) {
        result.player = tc(line.trim());
        break;
      }
    }
  }

  // ── Subset / variety ─────────────────────────────────────────────────────────
  // A line between the set line and the cert number that isn't the player name
  // e.g. "FUTURE STARS", "ARTIST'S PROOF", "ROOKIE CARD", "REFRACTOR"
  const subsetPatterns = [
    /ARTIST['']S\s+PROOF/i, /FUTURE\s+STARS/i, /ROOKIE\s+CARD/i,
    /REFRACTOR/i, /GOLD\s+REFRACTOR/i, /PRISM\s+REFRACTOR/i,
    /AUTO(?:GRAPH)?/i, /JERSEY/i, /PATCH/i, /PARALLEL/i,
    /GOLD\s+FOIL/i, /HOLO/i, /PRIZM/i, /CHROME/i,
    /(?:BLUE|RED|GREEN|PURPLE|ORANGE|YELLOW|PINK|BLACK|WHITE)\s+(?:PARALLEL|REFRACTOR|PRIZM)/i,
  ];
  for (const p of subsetPatterns) {
    const m = raw.match(p);
    if (m) { result.subset = tc(m[0]); break; }
  }
  // If no known subset pattern, look for a short all-caps line that's not the player
  if (!result.subset) {
    for (const line of lines) {
      const upper_line = line.trim().toUpperCase();
      if (
        upper_line.length > 3 &&
        upper_line.length < 30 &&
        /^[A-Z\s']+$/.test(upper_line) &&
        !upper_line.match(/\d/) &&
        upper_line !== (result.player?.toUpperCase() ?? "") &&
        upper_line !== (result.set?.toUpperCase() ?? "") &&
        !BRAND_KEYWORDS.has(upper_line) &&
        !NOT_A_NAME.has(upper_line)
      ) {
        result.subset = tc(line.trim());
        break;
      }
    }
  }

  return result;
}

// Detect grader from cert number format (used for manual cert entry)
export function detectGraderFromCert(certNumber: string): CertDetection["grader"] {
  const n = certNumber.replace(/\D/g, "");
  if (n.length === 10) return "BGS";
  if (n.length >= 7 && n.length <= 9) return "PSA";
  return "Unknown";
}
