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

  // BGGS (Beckett Gold) — check before BGS since BGGS contains "BGS"
  const bggsMatch = text.match(/(?:CERT[#\s]*|BGGS[#\s]*)?(\d{10})(?!\d)/);
  if (bggsMatch && text.includes("BGGS")) return { certNumber: bggsMatch[1], grader: "BGGS" };

  // BGS/Beckett: 10 consecutive digits
  const bgsMatch = text.match(/(?:CERT[#\s]*|BGS[#\s]*)?(\d{10})(?!\d)/);
  if (bgsMatch) return { certNumber: bgsMatch[1], grader: "BGS" };

  // PSA: 7–9 consecutive digits (e.g. 80239626 = 8 digits, 20881197 = 8 digits)
  const psaMatch = text.match(/(?:CERT[#\s]*|PSA[#\s]*)?(\d{7,9})(?!\d)/);
  if (psaMatch) return { certNumber: psaMatch[1], grader: "PSA" };

  // CGC: 10-digit
  const cgcMatch = text.match(/(?:CGC[#\s]*)?(\d{10})(?!\d)/);
  if (cgcMatch) return { certNumber: cgcMatch[1], grader: "CGC" };

  // SGC: 8-digit
  const sgcMatch = text.match(/(?:SGC[#\s]*)?(\d{8})(?!\d)/);
  if (sgcMatch) return { certNumber: sgcMatch[1], grader: "SGC" };

  // Last resort — any 7–10 digit block
  const fallback = text.match(/\b(\d{7,10})\b/);
  if (fallback) return { certNumber: fallback[1], grader: "Unknown" };

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

  // ── Year + Set from a line that starts with the year ─────────────────────────
  // e.g. "1987 TOPPS", "2021 BOWMAN CHROME", "1994 PINNACLE"
  for (const line of lines) {
    const m = line.match(/^(19\d{2}|20\d{2})\s+(.{2,40})$/i);
    if (m) {
      result.year = parseInt(m[1]);
      const setStr = m[2].trim().replace(/#.*$/, "").trim(); // strip card # if on same line
      if (setStr.length > 1) {
        result.set          = tc(setStr);
        result.manufacturer = deriveManufacturerLocal(setStr) ?? tc(setStr);
      }
      break;
    }
  }

  // ── Player name ──────────────────────────────────────────────────────────────
  // Look for an all-caps line of 2-4 words that looks like a name.
  // Skip lines that contain brand/grading keywords.
  for (const line of lines) {
    const words = line.trim().toUpperCase().split(/\s+/);
    const isName =
      words.length >= 2 &&
      words.length <= 4 &&
      words.every(w => /^[A-Z\-'\.]{2,}$/.test(w)) &&
      !words.some(w => NOT_A_NAME.has(w)) &&
      !line.match(/\d/);                    // no digits in a name
    if (isName) {
      result.player = tc(line.trim());
      break;
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
