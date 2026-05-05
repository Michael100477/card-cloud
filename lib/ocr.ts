/**
 * OCR pipeline for slab label reading.
 *
 * tesseract.js breaks inside Next.js's bundler because its internal worker
 * script path resolves to the wrong directory (C:\ROOT instead of project root).
 * The fix: spawn a standalone Node.js child process (scripts/ocr-worker.mjs)
 * that runs in a clean module context where path resolution works correctly.
 *
 * The Tesseract English language model is stored locally in tessdata/ so
 * there is no CDN download at runtime.
 */

import sharp from "sharp";
import { spawn } from "child_process";
import path from "path";

// ─── Image preprocessing ──────────────────────────────────────────────────────
// Crop to the label area (top 22%) before OCR — the cert label on PSA/BGS/SGC/CGC
// slabs is always in the top strip. This reduces a 1936×3273px image to ~430px
// tall, dramatically cutting OCR time and improving accuracy.

export async function preprocessSlab(imageBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const w    = meta.width  ?? 1200;
  const h    = meta.height ?? 1600;

  return sharp(imageBuffer)
    .extract({ left: 0, top: 0, width: w, height: Math.floor(h * 0.22) })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.5 })
    .resize({ width: 1200, withoutEnlargement: false })
    .png()
    .toBuffer();
}

// ─── OCR via child process ────────────────────────────────────────────────────

// Use PROJECT_ROOT env var so the path is correct when PM2 starts the server
// from a different working directory (process.cwd() may return C:\ROOT).
function projectRoot(): string {
  return process.env.PROJECT_ROOT ?? process.cwd();
}

export async function extractText(imageBuffer: Buffer): Promise<string> {
  const processed  = await preprocessSlab(imageBuffer);
  const root       = projectRoot();
  const workerPath = path.join(root, "scripts", "ocr-worker.mjs");
  const base64     = processed.toString("base64");

  // Pass image via stdin — NOT as a CLI argument.
  // Base64 of a slab image can be 300–400 KB which exceeds Windows'
  // 32,767-character command-line argument limit and silently fails.
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
      if (stderr) console.warn("[ocr-worker stderr]", stderr.slice(0, 500));
      try {
        const result = JSON.parse(stdout);
        if (result.error) reject(new Error(result.error));
        else resolve(result.text ?? "");
      } catch {
        const preview = stdout.slice(0, 200);
        console.error("[ocr-worker] bad output:", preview, "stderr:", stderr.slice(0, 200));
        reject(new Error(`OCR worker exited (${code}): ${preview}`));
      }
    });

    child.on("error", (err) => {
      console.error("[ocr-worker spawn error]", err);
      reject(err);
    });

    // Write base64 image to stdin and close the stream
    child.stdin.write(base64);
    child.stdin.end();
  });
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

  // PSA: 7–9 consecutive digits (80239626 = 8 digits)
  const psaMatch = text.match(/(?:CERT[#\s]*|PSA[#\s]*)?(\d{7,9})(?!\d)/);
  if (psaMatch) return { certNumber: psaMatch[1], grader: "PSA" };

  // CGC: 10-digit with leading zeros
  const cgcMatch = text.match(/(?:CGC[#\s]*)?(\d{10})(?!\d)/);
  if (cgcMatch) return { certNumber: cgcMatch[1], grader: "CGC" };

  // SGC: 8-digit
  const sgcMatch = text.match(/(?:SGC[#\s]*)?(\d{8})(?!\d)/);
  if (sgcMatch) return { certNumber: sgcMatch[1], grader: "SGC" };

  // Last resort
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
