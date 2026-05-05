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
  grader: "PSA" | "BGS" | "SGC" | "CGC" | "Unknown";
}

export function extractCertNumber(ocrText: string): CertDetection | null {
  const text = ocrText.replace(/\s+/g, " ").toUpperCase();

  // BGS/Beckett: 10 consecutive digits (check before PSA)
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

// Detect grader from cert number format (used for manual cert entry)
export function detectGraderFromCert(certNumber: string): CertDetection["grader"] {
  const n = certNumber.replace(/\D/g, "");
  if (n.length === 10) return "BGS";
  if (n.length >= 7 && n.length <= 9) return "PSA";
  return "Unknown";
}
