import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminUser } from "@/lib/admin";

const AI_LAB = process.env.AI_LAB_URL ?? "http://localhost:3002";

async function proxy(req: NextRequest, params: Promise<{ path: string[] }>) {
  const session = await auth();
  if (!session?.user?.id || !(await isAdminUser(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { path } = await params;
  const { search } = new URL(req.url);
  const target = `${AI_LAB}/api/${path.join("/")}${search}`;

  const body = req.method !== "GET" && req.method !== "HEAD"
    ? await req.arrayBuffer()
    : undefined;

  const upstream = await fetch(target, {
    method:  req.method,
    headers: { "Content-Type": req.headers.get("Content-Type") ?? "application/json" },
    body,
  });

  // Stream the response through (handles SSE / streaming agents output)
  return new NextResponse(upstream.body, {
    status:  upstream.status,
    headers: {
      "Content-Type":  upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}

export const GET    = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params);
export const POST   = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params);
export const PATCH  = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params);
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params);
