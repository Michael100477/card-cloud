"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPasswordAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const RULES = [
  { label: "8 or more characters", test: (p: string) => p.length >= 8 },
  { label: "One number",           test: (p: string) => /\d/.test(p) },
  { label: "One symbol",           test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

export default function ResetPasswordPage() {
  const [password, setPassword]     = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [error, setError]           = useState("");
  const [isPending, startTransition] = useTransition();

  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const passwordValid = RULES.every((r) => r.test(password));

  // No token in the URL — show a friendly error immediately
  if (!token) {
    return (
      <>
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
          <AlertIcon className="w-6 h-6 text-alert" />
        </div>
        <h1 className="text-navy text-2xl font-bold mb-2">Invalid link</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          This password reset link is missing or malformed. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="block w-full text-center bg-amber text-amber-dark font-semibold py-3 rounded-xl text-sm hover:brightness-105 transition-all"
        >
          Request a new link
        </Link>
      </>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!passwordValid) {
      setError("Password doesn't meet the requirements below.");
      return;
    }

    const fd = new FormData(e.currentTarget);
    if (fd.get("password") !== fd.get("confirmPassword")) {
      setError("Passwords don't match.");
      return;
    }

    startTransition(async () => {
      const result = await resetPasswordAction(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <h1 className="text-navy text-2xl font-bold mb-1">Choose a new password</h1>
      <p className="text-slate-500 text-sm mb-6">
        Pick something strong — this replaces your current password.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-100 text-alert text-sm rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Hidden token field */}
        <input type="hidden" name="token" value={token} />

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-navy mb-1.5">
            New password
          </label>
          <div className="relative">
            <input
              id="password" name="password" type={showPass ? "text" : "password"}
              required autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-11 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
              placeholder="Create a strong password"
            />
            <button
              type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
          </div>

          {password.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {RULES.map((rule) => {
                const met = rule.test(password);
                return (
                  <li key={rule.label} className={cn("flex items-center gap-1.5 text-xs", met ? "text-success" : "text-slate-400")}>
                    {met
                      ? <CheckIcon className="w-3.5 h-3.5" />
                      : <DotIcon   className="w-3.5 h-3.5" />}
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-navy mb-1.5">
            Confirm new password
          </label>
          <input
            id="confirmPassword" name="confirmPassword"
            type={showPass ? "text" : "password"}
            required autoComplete="new-password"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            placeholder="Repeat your new password"
          />
        </div>

        <button
          type="submit" disabled={isPending}
          className="w-full bg-amber text-amber-dark font-semibold py-3 rounded-xl text-sm hover:brightness-105 transition-all disabled:opacity-60 mt-1"
        >
          {isPending ? "Saving…" : "Set new password"}
        </button>
      </form>
    </>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function DotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
