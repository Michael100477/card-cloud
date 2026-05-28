/**
 * Cloudflare R2 client — S3-compatible object storage for production photos.
 *
 * Credentials are stored in the admin dashboard under Platform → Credentials →
 * Storage. The five service keys read here:
 *   r2_account_id     — Cloudflare account ID (32-char hex)
 *   r2_access_key     — R2 API token, access key ID
 *   r2_secret_key     — R2 API token, secret access key
 *   r2_bucket         — bucket name (e.g. "cardcloud-photos")
 *   r2_public_url     — public hostname for the bucket
 *                       (custom domain like https://photos.thecardcloud.com,
 *                        or Cloudflare-issued *.r2.dev URL if no custom domain)
 *
 * If r2_account_id is unset, the photo upload code falls back to writing
 * files to ./public/uploads/ on the local filesystem — fine for local dev,
 * NOT for prod.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";

interface R2Creds {
  accountId:   string;
  accessKey:   string;
  secretKey:   string;
  bucket:      string;
  publicUrl:   string;
}

let cachedClient: { creds: R2Creds; client: S3Client } | null = null;

async function loadCreds(): Promise<R2Creds | null> {
  const rows = await db.siteCredential.findMany({
    where: { service: { in: ["r2_account_id", "r2_access_key", "r2_secret_key", "r2_bucket", "r2_public_url"] } },
  });
  const get = (k: string) => rows.find(r => r.service === k)?.value?.trim() ?? "";
  const creds = {
    accountId: get("r2_account_id"),
    accessKey: get("r2_access_key"),
    secretKey: get("r2_secret_key"),
    bucket:    get("r2_bucket"),
    publicUrl: get("r2_public_url"),
  };
  if (!creds.accountId || !creds.accessKey || !creds.secretKey || !creds.bucket || !creds.publicUrl) return null;
  return creds;
}

export async function r2Configured(): Promise<boolean> {
  return (await loadCreds()) !== null;
}

async function getClient(): Promise<{ client: S3Client; creds: R2Creds }> {
  const creds = await loadCreds();
  if (!creds) throw new Error("R2 is not configured — fill in r2_account_id, r2_access_key, r2_secret_key, r2_bucket, r2_public_url under Admin → Credentials → Storage.");

  // Reuse client if creds haven't changed (no need to rebuild S3Client on every request)
  if (cachedClient
    && cachedClient.creds.accountId === creds.accountId
    && cachedClient.creds.accessKey === creds.accessKey
    && cachedClient.creds.secretKey === creds.secretKey) {
    return { client: cachedClient.client, creds };
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${creds.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     creds.accessKey,
      secretAccessKey: creds.secretKey,
    },
  });
  cachedClient = { creds, client };
  return { client, creds };
}

/** Upload a buffer to R2, returns the public URL the browser can load. */
export async function uploadToR2(opts: {
  key:         string;  // path inside the bucket, e.g. "uploads/abc123.jpg"
  body:        Buffer;
  contentType: string;
}): Promise<string> {
  const { client, creds } = await getClient();
  await client.send(new PutObjectCommand({
    Bucket:      creds.bucket,
    Key:         opts.key,
    Body:        opts.body,
    ContentType: opts.contentType,
    // Public-read is enforced by the R2 bucket's public access setting,
    // not per-object — so no ACL header needed (R2 doesn't support them anyway).
  }));
  // Strip any trailing slash so URLs are clean
  const base = creds.publicUrl.replace(/\/$/, "");
  return `${base}/${opts.key}`;
}
