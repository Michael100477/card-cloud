/**
 * Training data collection pipeline.
 *
 * When a user has given trainingConsent, successful scans and confirmed
 * card saves log the image + metadata here. These examples feed the
 * custom model training pipeline.
 *
 * Storage: images go to R2 under training-data/{source}/{id}.jpg
 * Database: TrainingExample row with metadata + image key
 *
 * Note: R2 upload is a no-op until R2 credentials are filled in under
 * Admin → Credentials → Storage. Images are still logged to the DB so
 * you know what to upload later.
 */

import { db } from "@/lib/db";
import { r2Configured, uploadToR2 } from "@/lib/r2";

export interface TrainingMeta {
  source:      "scan" | "manual_card" | "ebay_agent";
  grader?:     string;
  certNumber?: string;
  player?:     string;
  year?:       number;
  manufacturer?: string;
  set?:        string;
  subset?:     string;
  cardNumber?: string;
  grade?:      string;
}

/**
 * Log a training example. Called after a successful scan or card save
 * when the user has given consent.
 *
 * imageBuffer: the raw image bytes (JPEG/PNG)
 * meta: extracted/verified card metadata
 */
export async function logTrainingExample(
  imageBuffer: Buffer,
  meta: TrainingMeta,
  userId: string
): Promise<void> {
  try {
    // Check consent
    const user = await db.user.findUnique({
      where:  { id: userId },
      select: { trainingConsent: true },
    });
    if (!user?.trainingConsent) return;

    // Generate a unique key for this image
    const id      = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const imageKey = `training-data/${meta.source}/${id}.jpg`;

    // Upload to R2 if configured, otherwise just record the intent
    await uploadToTrainingStorage(imageBuffer, imageKey);

    // Record in database
    await db.trainingExample.create({
      data: {
        imageKey,
        source:       meta.source,
        grader:       meta.grader       ?? null,
        certNumber:   meta.certNumber   ?? null,
        player:       meta.player       ?? null,
        year:         meta.year         ?? null,
        manufacturer: meta.manufacturer ?? null,
        set:          meta.set          ?? null,
        subset:       meta.subset       ?? null,
        cardNumber:   meta.cardNumber   ?? null,
        grade:        meta.grade        ?? null,
        verified:     false, // awaits human review
      },
    });
  } catch (err) {
    // Non-fatal — training data loss is acceptable
    console.warn("[training] log failed:", err);
  }
}

async function uploadToTrainingStorage(buffer: Buffer, key: string): Promise<void> {
  if (!(await r2Configured())) {
    console.log(`[training] R2 not configured — key logged: ${key}`);
    return;
  }
  await uploadToR2({ key, body: buffer, contentType: "image/jpeg" });
}
