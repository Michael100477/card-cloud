"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

// ─── Sign up ──────────────────────────────────────────────────────────────────

export async function signUpAction(formData: FormData) {
  const email    = (formData.get("email")    as string).toLowerCase().trim();
  const username = (formData.get("username") as string).trim();
  const password =  formData.get("password") as string;

  if (!email || !username || !password) {
    return { error: "All fields are required." };
  }

  const existing = await db.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });

  if (existing?.email === email) {
    return { error: "An account with that email already exists." };
  }
  if (existing?.username === username) {
    return { error: "That username is already taken." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.create({
    data: {
      email,
      username,
      passwordHash,
      planTier: "TRIAL",
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Auto sign-in after registration
  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
}

// ─── Sign in ──────────────────────────────────────────────────────────────────

export async function loginAction(formData: FormData) {
  try {
    await signIn("credentials", {
      email:    formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error; // redirect() throws — let it propagate
  }
}

// ─── Password reset request ───────────────────────────────────────────────────

export async function requestPasswordResetAction(formData: FormData) {
  const email = (formData.get("email") as string).toLowerCase().trim();

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user) {
    // Invalidate any existing tokens for this user
    await db.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token     = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await db.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3001"}/reset-password?token=${token}`;

    // Dev: log to console. Production: replace with Postmark email.
    console.log(`[Password Reset] ${email} → ${resetUrl}`);
  }

  // Always return success — never reveal whether the email exists (spec §23)
  return { success: true };
}

// ─── Password reset confirm ───────────────────────────────────────────────────

export async function resetPasswordAction(formData: FormData) {
  const token    =  formData.get("token")    as string;
  const password =  formData.get("password") as string;

  const record = await db.passwordResetToken.findUnique({
    where: { token },
    select: { userId: true, expiresAt: true },
  });

  if (!record || record.expiresAt < new Date()) {
    return { error: "This reset link has expired or is invalid. Please request a new one." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.update({
    where: { id: record.userId },
    data:  { passwordHash },
  });

  await db.passwordResetToken.delete({ where: { token } });

  redirect("/login?reset=success");
}
