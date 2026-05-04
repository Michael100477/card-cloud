/**
 * Photo upload API — stores files in public/uploads/ for local development.
 *
 * When Cloudflare R2 is configured, replace the write logic below with a
 * presigned-PUT to R2 and return the R2 public URL instead. The form code
 * that calls this endpoint never needs to change.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { randomBytes } from "crypto";
import { auth } from "@/auth";

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
  const dir      = join(process.cwd(), "public", "uploads");

  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);

  return NextResponse.json({ url: `/uploads/${filename}` });
}
