import { auth } from "@/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";

export class AdminError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const AI_LAB_TOKEN_SERVICE = "ai_lab_admin_token";

/** Accept admin auth from either:
 *   (1) a NextAuth session cookie + isAdmin/ADMIN_EMAIL check (browser flows), or
 *   (2) Authorization: Bearer <token> matching site_credentials.ai_lab_admin_token
 *       (local CC-AI-Lab calling back via /api/admin/[...path] relay). */
export async function requireAdmin(): Promise<string> {
  // (2) Bearer-token path — used by the local AI Lab site's relay
  const h        = await headers();
  const bearerM  = (h.get("authorization") ?? "").match(/^Bearer\s+(.+)$/);
  if (bearerM) {
    const row = await db.siteCredential.findUnique({
      where:  { service: AI_LAB_TOKEN_SERVICE },
      select: { value: true },
    });
    if (row?.value && bearerM[1] === row.value) {
      const adminEmail = process.env.ADMIN_EMAIL;
      const admin = adminEmail
        ? await db.user.findUnique({ where: { email: adminEmail }, select: { id: true } })
        : null;
      return admin?.id ?? "ai-lab-relay";
    }
  }

  // (1) Session cookie path
  const session = await auth();
  if (!session?.user?.id) throw new AdminError(401, "Unauthorized");

  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { isAdmin: true, email: true },
  });

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!user?.isAdmin && user?.email !== adminEmail) {
    throw new AdminError(403, "Forbidden");
  }

  return session.user.id;
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where:  { id: userId },
    select: { isAdmin: true, email: true },
  });
  return !!user?.isAdmin || user?.email === process.env.ADMIN_EMAIL;
}
