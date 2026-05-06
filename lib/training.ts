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
 * Note: R2 upload is a no-op until CLOUDFLARE_R2_* env vars are set.
 * Images are still logged to the DB so you know what to upload later.
 */

import { db } from "@/lib/db";

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
  // R2 upload — wired up when Cloudflare R2 credentials are configured
  const accountId  = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKey  = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretKey  = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket     = process.env.CLOUDFLARE_R2_BUCKET ?? "card-cloud-photos";

  if (!accountId || !accessKey || !secretKey) {
    // R2 not configured yet — image key is logged to DB, upload later
    console.log(`[training] R2 not configured — key logged: ${key}`);
    return;
  }

  // Will be replaced with proper R2 SDK when we wire up R2
  // For now, this is a placeholder that compiles cleanly
  console.log(`[training] Would upload to R2: ${bucket}/${key} (${buffer.length} bytes)`);
}
