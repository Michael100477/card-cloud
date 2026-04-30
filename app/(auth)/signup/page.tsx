"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signUpAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const RULES = [
  { label: "8 or more characters", test: (p: string) => p.length >= 8 },
  { label: "One number",           test: (p: string) => /\d/.test(p) },
  { label: "One symbol",           test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

export default function SignupPage() {
  const [password, setPassword]     = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [error, setError]           = useState("");
  const [isPending, startTransition] = useTransition();

  const passwordValid = RULES.every((r) => r.test(password));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fd = new FormData(e.currentTarget);
    if (!passwordValid) {
      setError("Password doesn't meet the requirements below.");
      return;
    }
    if (fd.get("password") !== fd.get("confirmPassword")) {
      setError("Passwords don't match.");
      return;
    }

    startTransition(async () => {
      const result = await signUpAction(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <h1 className="text-navy text-2xl font-bold mb-1">Create your account</h1>
      <p className="text-slate-500 text-sm mb-6">
        Free for your first month — no credit card needed.
      </p>

      {/* Google OAuth */}
      <a
        href="/api/auth/signin/google"
        className="flex items-center justify-center gap-3 w-full border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors mb-5"
      >
        <GoogleIcon className="w-5 h-5" />
        Continue with Google
      </a>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-slate-400 text-xs">or</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-100 text-alert text-sm rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-navy mb-1.5">
            Email
          </label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-navy mb-1.5">
            Username
          </label>
          <input
            id="username" name="username" type="text" required autoComplete="username"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            placeholder="CardCollector99"
          />
          <p className="text-slate-400 text-xs mt-1">This is your public collector name.</p>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-navy mb-1.5">
            Password
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

          {/* Live validation rules */}
          {password.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {RULES.map((rule) => {
                const met = rule.test(password);
                return (
                  <li key={rule.label} className={cn("flex items-center gap-1.5 text-xs", met ? "text-success" : "text-slate-400")}>
                    {met ? <CheckIcon className="w-3.5 h-3.5" /> : <DotIcon className="w-3.5 h-3.5" />}
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-navy mb-1.5">
            Confirm password
          </label>
          <input
            id="confirmPassword" name="confirmPassword" type={showPass ? "text" : "password"}
            required autoComplete="new-password"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            placeholder="Repeat your password"
          />
        </div>

        <button
          type="submit" disabled={isPending}
          className="w-full bg-amber text-amber-dark font-semibold py-3 rounded-xl text-sm hover:brightness-105 transition-all disabled:opacity-60 mt-1"
        >
          {isPending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-slate-400 text-xs text-center mt-5">
        By signing up you agree to our{" "}
        <Link href="/terms" className="text-brand hover:underline">Terms</Link>
        {" "}and{" "}
        <Link href="/privacy" className="text-brand hover:underline">Privacy Policy</Link>.
      </p>

      <p className="text-slate-500 text-sm text-center mt-4">
        Already have an account?{" "}
        <Link href="/login" className="text-brand font-semibold hover:underline">Log in</Link>
      </p>
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
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
