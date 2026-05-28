import { auth } from "@/auth";
import { db } from "@/lib/db";

export class AdminError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requireAdmin(): Promise<string> {
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
