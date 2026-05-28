/**
 * Cloudflare R2 client — S3-compatible object storage for production photos.
 *
 * Production env vars (set in Railway dashboard):
 *   R2_ACCOUNT_ID       — Cloudflare account ID (from R2 dashboard URL)
 *   R2_ACCESS_KEY_ID    — R2 API token, access key
 *   R2_SECRET_ACCESS_KEY — R2 API token, secret key
 *   R2_BUCKET           — bucket name (e.g. "cardcloud-photos")
 *   R2_PUBLIC_URL       — public hostname for the bucket
 *                         (custom domain like https://photos.thecardcloud.com,
 *                          or Cloudflare-issued *.r2.dev URL if no custom domain)
 *
 * If R2_ACCOUNT_ID is unset, the photo upload code falls back to writing files
 * to ./public/uploads/ on the local filesystem — fine for local dev, NOT for prod.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let cachedClient: S3Client | null = null;

export function r2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_URL
  );
}

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return cachedClient;
}

/** Upload a buffer to R2, returns the public URL the browser can load. */
export async function uploadToR2(opts: {
  key:         string;  // path inside the bucket, e.g. "uploads/abc123.jpg"
  body:        Buffer;
  contentType: string;
}): Promise<string> {
  if (!r2Configured()) {
    throw new Error("R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL.");
  }
  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET!,
    Key:         opts.key,
    Body:        opts.body,
    ContentType: opts.contentType,
    // Public-read is enforced by the R2 bucket's public access setting,
    // not per-object — so no ACL header needed (R2 doesn't support them anyway).
  }));
  // Strip any trailing slash so URLs are clean
  const base = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");
  return `${base}/${opts.key}`;
}
