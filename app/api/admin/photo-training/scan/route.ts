/**
 * POST /api/admin/photo-training/scan
 *
 * Folder structure — same for every category, including rejected photos:
 *   C:\cardtraining\[category]\[face]\[card_name]\
 *     before.jpg      — original photo          (always required)
 *     after.jpg       — correctly cropped result (only required if Accepted)
 *     description.txt — structured properties; the Accepted/Rejected line
 *                       is read FIRST before any image files are checked
 *
 * Accept/reject is determined solely by description.txt:
 *   Accepted: Can be cropped   → after.jpg required
 *   Rejected: Multiple cards   → no after.jpg; model learns what to refuse
 *   Rejected: Card obscured    →   "
 *   Rejected: Too far away     →   "
 *   Rejected: Steep angle      →   "
 *   Rejected: Blurry           →   "
 *   Rejected: Glare covering card →  "
 *   Rejected: Wrong subject    →   "
 *   Rejected: Already cropped  →   "
 *
 * For rejected samples, beforeThumb is stored as afterThumb so the model
 * sees the bad photo paired with its rejection label and learns to refuse it.
 *
 * sourcePath stored in DB: "category/face/card_name"
 */

import { NextResponse } from "next/server";
import * as fs   from "fs";
import * as path from "path";
import sharp from "sharp";
import { db } from "@/lib/db";

const TRAINING_ROOT = "C:\\cardtraining";
const THUMB_SIZE    = 400;

const VALID_CATEGORIES = new Set([
  "graded_psa", "graded_psa_back", "graded_psa_closeup",
  "graded_bgs", "graded_sgc", "graded_cgc", "graded_hga", "graded_other",
  "raw_bare", "raw_toploader", "raw_toploader_sleeve",
  "raw_onetouch", "raw_sleeve_only", "raw_unsorted",
]);

const VALID_FACES = new Set(["front", "back"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function toThumb(filePath: string): Promise<string> {
  const buf = await sharp(filePath)
    .rotate()
    .resize(THUMB_SIZE, undefined, { fit: "inside" })
    .jpeg({ quality: 82 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

function findFile(dir: string, prefix: string): string | null {
  const files = fs.readdirSync(dir);
  const match = files.find(f =>
    f.toLowerCase().startsWith(prefix.toLowerCase()) &&
    /\.(jpg|jpeg|png|webp)$/i.test(f)
  );
  return match ? path.join(dir, match) : null;
}

function readDescription(dir: string): string {
  const txtPath = path.join(dir, "description.txt");
  return fs.existsSync(txtPath) ? fs.readFileSync(txtPath, "utf-8").trim() : "";
}

// Accept/reject is determined by the last meaningful line of description.txt.
// Returns true if the description contains a "Rejected:" line.
function isRejected(description: string): boolean {
  return description.split("\n").some(l => l.trim().toLowerCase().startsWith("rejected:"));
}

async function estimateCenter(filePath: string): Promise<{ cx: number; cy: number }> {
  try {
    const SAMPLE = 200;
    const { data, info } = await sharp(filePath)
      .rotate()
      .resize(SAMPLE, undefined, { fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pix = data as unknown as Uint8Array;
    const { width, height, channels } = info;

    const brightnesses: number[] = [];
    for (let i = 0; i < width * height; i++) {
      const p = i * channels;
      brightnesses.push((pix[p] + pix[p+1] + pix[p+2]) / 3);
    }
    brightnesses.sort((a, b) => a - b);
    const median = brightnesses[Math.floor(brightnesses.length / 2)];

    let sumX = 0, sumY = 0, count = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels;
        const b = (pix[i] + pix[i+1] + pix[i+2]) / 3;
        if (Math.abs(b - median) > 30) { sumX += x; sumY += y; count++; }
      }
    }
    if (count < 50) return { cx: 0.5, cy: 0.5 };
    return { cx: sumX / count / width, cy: sumY / count / height };
  } catch {
    return { cx: 0.5, cy: 0.5 };
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST() {
  if (!fs.existsSync(TRAINING_ROOT)) {
    return NextResponse.json({ error: `Training folder not found: ${TRAINING_ROOT}` }, { status: 400 });
  }

  const results = { found: 0, imported: 0, skipped: 0, errors: [] as string[] };

  // Level 1 — category
  const categoryDirs = fs.readdirSync(TRAINING_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory() && VALID_CATEGORIES.has(d.name));

  for (const catDir of categoryDirs) {
    const category = catDir.name;
    const catPath  = path.join(TRAINING_ROOT, category);

    // Level 2 — face (front | back)
    const faceDirs = fs.readdirSync(catPath, { withFileTypes: true })
      .filter(d => d.isDirectory() && VALID_FACES.has(d.name.toLowerCase()));

    for (const faceDir of faceDirs) {
      const face     = faceDir.name.toLowerCase();
      const facePath = path.join(catPath, faceDir.name);

      // Level 3 — card name
      const cardDirs = fs.readdirSync(facePath, { withFileTypes: true })
        .filter(d => d.isDirectory());

      for (const cardDir of cardDirs) {
        const cardName   = cardDir.name;
        const cardPath   = path.join(facePath, cardName);
        const sourcePath = `${category}/${face}/${cardName}`;

        // Read description.txt first — determines whether after.jpg is needed
        const description = readDescription(cardPath);
        const rejected    = isRejected(description);

        const beforeFile = findFile(cardPath, "before");
        const afterFile  = rejected ? null : findFile(cardPath, "after");

        // Must have before.jpg; accepted samples must also have after.jpg
        if (!beforeFile)            continue;
        if (!rejected && !afterFile) continue;
        results.found++;

        const existing = await db.photoTrainingSample.findUnique({ where: { sourcePath } });
        if (existing) { results.skipped++; continue; }

        try {
          const [beforeThumb, afterThumbOrUndef, center] = await Promise.all([
            toThumb(beforeFile),
            afterFile ? toThumb(afterFile) : Promise.resolve(undefined as string | undefined),
            estimateCenter(beforeFile),
          ]);

          // Rejected samples: beforeThumb stored as afterThumb so the model
          // sees the bad photo paired with its rejection label.
          const afterThumb = afterThumbOrUndef ?? beforeThumb;

          await db.photoTrainingSample.create({
            data: { beforeThumb, afterThumb, cx: center.cx, cy: center.cy, category, description, sourcePath },
          });

          results.imported++;
          console.log(`[photo-training] Imported${rejected ? " (rejected)" : ""}: ${sourcePath}`);
        } catch (e) {
          results.errors.push(`${sourcePath}: ${String(e).slice(0, 120)}`);
        }
      }
    }
  }

  return NextResponse.json(results);
}
