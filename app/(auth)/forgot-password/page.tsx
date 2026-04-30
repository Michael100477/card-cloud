"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted]   = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await requestPasswordResetAction(fd);
      setSubmitted(true); // always show success — never reveal if email exists
    });
  }

  if (submitted) {
    return (
      <>
        <div className="w-12 h-12 rounded-2xl bg-brand-muted flex items-center justify-center mb-5">
          <MailIcon className="w-6 h-6 text-brand" />
        </div>
        <h1 className="text-navy text-2xl font-bold mb-2">Check your email</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          If an account exists for that email address, you&apos;ll receive a
          password reset link within a few minutes. The link expires in 30 minutes.
        </p>
        <p className="text-slate-400 text-xs leading-relaxed mb-6">
          Don&apos;t see it? Check your spam folder, or{" "}
          <button
            onClick={() => setSubmitted(false)}
            className="text-brand hover:underline"
          >
            try again
          </button>
          .
        </p>
        <Link
          href="/login"
          className="block w-full text-center bg-amber text-amber-dark font-semibold py-3 rounded-xl text-sm hover:brightness-105 transition-all"
        >
          Back to log in
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-navy text-2xl font-bold mb-1">Reset your password</h1>
      <p className="text-slate-500 text-sm mb-6">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-navy mb-1.5">
            Email address
          </label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit" disabled={isPending}
          className="w-full bg-amber text-amber-dark font-semibold py-3 rounded-xl text-sm hover:brightness-105 transition-all disabled:opacity-60"
        >
          {isPending ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="text-slate-500 text-sm text-center mt-5">
        Remembered it?{" "}
        <Link href="/login" className="text-brand font-semibold hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}
