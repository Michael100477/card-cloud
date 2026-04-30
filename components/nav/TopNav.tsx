"use client";

import { useState } from "react";
import Link from "next/link";

export function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="bg-navy">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <CardStackIcon className="w-7 h-7 text-amber" />
            <span className="text-sm leading-none">
              <span className="text-white/60 font-normal">The </span>
              <span className="text-brand font-bold text-base">Card Cloud</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-7">
            <Link
              href="/explore"
              className="text-white/75 hover:text-white text-sm font-medium transition-colors"
            >
              Explore
            </Link>
            <Link
              href="/articles"
              className="text-white/75 hover:text-white text-sm font-medium transition-colors"
            >
              Articles
            </Link>
            <Link
              href="/login"
              className="text-white/75 hover:text-white text-sm font-medium transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-amber text-amber-dark text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-105 transition-all"
            >
              Sign up free
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-white/80 hover:text-white p-2 -mr-2"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-light-navy border-t border-white/10">
          <div className="px-4 py-5 flex flex-col gap-5">
            <Link
              href="/explore"
              className="text-white/80 hover:text-white text-sm font-medium"
              onClick={() => setMobileOpen(false)}
            >
              Explore
            </Link>
            <Link
              href="/articles"
              className="text-white/80 hover:text-white text-sm font-medium"
              onClick={() => setMobileOpen(false)}
            >
              Articles
            </Link>
            <Link
              href="/login"
              className="text-white/80 hover:text-white text-sm font-medium"
              onClick={() => setMobileOpen(false)}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-amber text-amber-dark text-sm font-semibold px-4 py-3 rounded-lg text-center"
              onClick={() => setMobileOpen(false)}
            >
              Sign up free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Icon helpers ──────────────────────────────────────────────────────────────

function CardStackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 24" fill="none" aria-hidden="true">
      <rect x="0" y="8" width="21" height="14" rx="2.5" fill="currentColor" opacity="0.3" />
      <rect x="3" y="4" width="21" height="14" rx="2.5" fill="currentColor" opacity="0.6" />
      <rect x="6" y="0" width="21" height="14" rx="2.5" fill="currentColor" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
