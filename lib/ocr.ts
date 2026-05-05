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

// ─── Label region extraction ──────────────────────────────────────────────────
// The cert label is always on one SHORT edge of the slab.
// We try the most likely edge first, then fall back to others if OCR misses.

type EdgeResult = { buffer: Buffer; label: string };

async function extractEdges(imageBuffer: Buffer): Promise<EdgeResult[]> {
  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width  ?? 1200;
  const h = meta.height ?? 1600;

  const edges: EdgeResult[] = [];

  if (h >= w) {
    // Portrait — label most likely at TOP, then BOTTOM
    edges.push({
      label: "top",
      buffer: await sharp(imageBuffer)
        .extract({ left: 0, top: 0, width: w, height: Math.floor(h * 0.22) })
        .toBuffer(),
    });
    edges.push({
      label: "bottom",
      buffer: await sharp(imageBuffer)
        .extract({ left: 0, top: Math.floor(h * 0.78), width: w, height: Math.floor(h * 0.22) })
        .toBuffer(),
    });
  } else {
    // Landscape — label most likely on LEFT or RIGHT edge (rotated 90°)
    edges.push({
      label: "left-90",
      buffer: await sharp(imageBuffer)
        .extract({ left: 0, top: 0, width: Math.floor(w * 0.22), height: h })
        .rotate(90)
        .toBuffer(),
    });
    edges.push({
      label: "right-90",
      buffer: await sharp(imageBuffer)
        .extract({ left: Math.floor(w * 0.78), top: 0, width: Math.floor(w * 0.22), height: h })
        .rotate(-90)
        .toBuffer(),
    });
    // Also try the top in case the photo is a slight crop
    edges.push({
      label: "top",
      buffer: await sharp(imageBuffer)
        .extract({ left: 0, top: 0, width: w, height: Math.floor(h * 0.22) })
        .toBuffer(),
    });
  }

  return edges;
}

// ─── Pre-processing ───────────────────────────────────────────────────────────

async function enhanceForOCR(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.5 })
    .resize({ width: 1200, withoutEnlargement: false })
    .png()
    .toBuffer();
}

// ─── OCR via child process ────────────────────────────────────────────────────
// Spawns scripts/ocr-worker.mjs as a plain Node.js process so tesseract.js
// never runs inside Next.js's bundler (broken path resolution there).
// Image passed via stdin to avoid Windows 32,767-char CLI arg limit.

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
      if (stderr) console.warn("[ocr-worker stderr]", stderr.slice(0, 500));
      try {
        const result = JSON.parse(stdout);
        if (result.error) reject(new Error(result.error));
        else resolve(result.text ?? "");
      } catch {
        console.error("[ocr-worker] bad output:", stdout.slice(0, 200), "stderr:", stderr.slice(0, 200));
        reject(new Error(`OCR worker exited (${code}): ${stdout.slice(0, 100)}`));
      }
    });

    child.on("error", (err) => {
      console.error("[ocr-worker spawn error]", err);
      reject(err);
    });

    child.stdin.write(base64);
    child.stdin.end();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function extractText(imageBuffer: Buffer): Promise<string> {
  const edges = await extractEdges(imageBuffer);

  // Try each edge until we get text that contains a plausible cert number
  for (const edge of edges) {
    try {
      const enhanced = await enhanceForOCR(edge.buffer);
      const text     = await runOCR(enhanced);
      // Return as soon as we find a digit sequence long enough to be a cert
      if (/\d{7,10}/.test(text)) {
        console.log(`[OCR] cert found in ${edge.label} edge`);
        return text;
      }
    } catch (err) {
      console.warn(`[OCR] ${edge.label} edge failed:`, err);
    }
  }

  // No edge yielded a cert — return the text from the first edge anyway
  // so the caller can show it as debug info
  try {
    const enhanced = await enhanceForOCR(edges[0].buffer);
    return await runOCR(enhanced);
  } catch {
    return "";
  }
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

  // PSA: 7–9 consecutive digits
  const psaMatch = text.match(/(?:CERT[#\s]*|PSA[#\s]*)?(\d{7,9})(?!\d)/);
  if (psaMatch) return { certNumber: psaMatch[1], grader: "PSA" };

  // CGC: 10-digit
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
