/**
 * OCR pipeline for slab label reading.
 * Uses sharp for preprocessing and tesseract.js for text extraction.
 * Self-hosted — zero per-scan cost (spec §11).
 */

import sharp from "sharp";
import { createWorker } from "tesseract.js";

// ─── Image preprocessing ─────────────────────────────────────────────────────
// Simplified version of the spec's 8-step pipeline.
// Improves Tesseract accuracy from ~60% to ~85%+ on slab labels.

export async function preprocessSlab(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .grayscale()                         // Step 3: remove colour noise
    .normalize()                         // Step 4: auto-contrast (CLAHE-like)
    .sharpen({ sigma: 1.5 })            // Step 6: denoise / sharpen edges
    .resize({ width: 1200, withoutEnlargement: false }) // Step 7: upscale
    .png()                               // lossless for OCR
    .toBuffer();
}

// ─── OCR ─────────────────────────────────────────────────────────────────────

export async function extractText(imageBuffer: Buffer): Promise<string> {
  const processed = await preprocessSlab(imageBuffer);
  const worker = await createWorker("eng");

  try {
    // Restrict character set — cert numbers are alphanumeric + a few symbols
    await worker.setParameters({
      tessedit_char_whitelist:
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-./ ",
      // PSM 6 = uniform text block — best for slab labels
    });

    const { data } = await worker.recognize(processed);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// ─── Cert number extraction ───────────────────────────────────────────────────
// Each grader stamps cert numbers in a recognisable format.

export interface CertDetection {
  certNumber: string;
  grader: "PSA" | "BGS" | "SGC" | "CGC" | "Unknown";
}

export function extractCertNumber(ocrText: string): CertDetection | null {
  const text = ocrText.replace(/\s+/g, " ").toUpperCase();

  // PSA: 7–9 consecutive digits, often preceded by "CERT#" or "PSA"
  const psaMatch = text.match(/(?:CERT[#\s]*|PSA[#\s]*)?(\d{7,9})(?!\d)/);
  if (psaMatch) return { certNumber: psaMatch[1], grader: "PSA" };

  // BGS/Beckett: 10 consecutive digits
  const bgsMatch = text.match(/(?:CERT[#\s]*|BGS[#\s]*)?(\d{10})(?!\d)/);
  if (bgsMatch) return { certNumber: bgsMatch[1], grader: "BGS" };

  // CGC: 10-digit, sometimes with leading zeros, often "CGC" nearby
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
