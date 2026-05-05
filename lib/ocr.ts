/**
 * OCR pipeline for slab label reading.
 * Uses sharp for preprocessing and tesseract.js for text extraction.
 * Self-hosted — zero per-scan cost (spec §11).
 */

import sharp from "sharp";
import { createWorker } from "tesseract.js";

// ─── Image preprocessing ──────────────────────────────────────────────────────
// Key insight: PSA/BGS/SGC/CGC labels are always in the top strip of the slab.
// Cropping to just that area dramatically reduces image size and OCR time.

export async function preprocessSlab(imageBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width  ?? 1200;
  const h = meta.height ?? 1600;

  // Crop to top 22% — that's where the cert label lives on all major graders
  const labelH = Math.floor(h * 0.22);

  return sharp(imageBuffer)
    .extract({ left: 0, top: 0, width: w, height: labelH }) // crop to label
    .grayscale()                                              // remove colour noise
    .normalize()                                              // auto-contrast
    .sharpen({ sigma: 1.5 })                                 // sharpen edges
    .resize({ width: 1200, withoutEnlargement: false })      // upscale for Tesseract
    .png()
    .toBuffer();
}

// ─── OCR ──────────────────────────────────────────────────────────────────────

export async function extractText(imageBuffer: Buffer): Promise<string> {
  const processed = await preprocessSlab(imageBuffer);

  // createWorker downloads the eng language model (~4 MB) on first run.
  // Subsequent calls use the cached file so they're fast.
  const worker = await createWorker("eng", 1, {
    // Suppress verbose Tesseract progress logs
    logger: () => {},
  });

  try {
    await worker.setParameters({
      tessedit_char_whitelist:
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-./ ",
    });

    const { data } = await worker.recognize(processed);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// ─── Cert number extraction ───────────────────────────────────────────────────

export interface CertDetection {
  certNumber: string;
  grader: "PSA" | "BGS" | "SGC" | "CGC" | "Unknown";
}

export function extractCertNumber(ocrText: string): CertDetection | null {
  const text = ocrText.replace(/\s+/g, " ").toUpperCase();

  // BGS/Beckett: 10 consecutive digits (check before PSA to avoid mis-match)
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

// Detect grader from cert number format alone (used for manual cert entry)
export function detectGraderFromCert(certNumber: string): CertDetection["grader"] {
  const n = certNumber.replace(/\D/g, "");
  if (n.length === 10) return "BGS";   // BGS and CGC both use 10 digits
  if (n.length === 8)  return "PSA";   // PSA typically 8 digits
  if (n.length === 7 || n.length === 9) return "PSA";
  return "Unknown";
}
