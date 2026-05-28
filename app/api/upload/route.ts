/**
 * Photo upload API.
 *
 * - If Cloudflare R2 is configured (env vars set), uploads go to R2 and we
 *   return the public R2 URL.
 * - Otherwise (local dev), files write to ./public/uploads/ on disk and we
 *   return a relative /uploads/ URL.
 *
 * The form code that calls this endpoint never has to know which path was used.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { r2Configured, uploadToR2 } from "@/lib/r2";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file)                         return NextResponse.json({ error: "No file provided" },          { status: 400 });
  if (!ALLOWED.has(file.type))       return NextResponse.json({ error: "File type not allowed" },     { status: 400 });
  if (file.size > MAX_BYTES)         return NextResponse.json({ error: "File too large (max 10 MB)" },{ status: 400 });

  const buffer   = Buffer.from(await file.arrayBuffer());
  const ext      = extname(file.name).toLowerCase() || ".jpg";
  const filename = `${randomBytes(16).toString("hex")}${ext}`;

  // Production: Cloudflare R2. Local dev: write to public/uploads.
  if (r2Configured()) {
    const url = await uploadToR2({
      key:         `uploads/${filename}`,
      body:        buffer,
      contentType: file.type,
    });
    return NextResponse.json({ url });
  }

  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);
  return NextResponse.json({ url: `/uploads/${filename}` });
}
