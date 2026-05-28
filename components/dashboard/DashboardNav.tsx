"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { CardCloudMark } from "@/components/brand/CardCloudLogo";

interface DashboardNavProps {
  username: string | null;
  displayName: string | null;
  email: string;
  profilePhoto: string | null;
}

const NAV_LINKS = [
  { label: "Home",           href: "/dashboard" },
  { label: "Feed",           href: "/dashboard/feed" },
  { label: "My Collections", href: "/dashboard/my-collections" },
  { label: "Watchlist",      href: "/dashboard/watchlist" },
  { label: "Following",      href: "/dashboard/following" },
  { label: "Consign",        href: "/dashboard/consign" },
  { label: "Sell",           href: "/exchange/sell" },
  { label: "Trade",          href: "/dashboard/trade" },
];

export function DashboardNav({ username, displayName, email, profilePhoto }: DashboardNavProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = (displayName ?? email)
    .split(/[\s@]/)[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <nav className="bg-navy border-b border-white/10 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15" style={{ height: "60px" }}>

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <CardCloudMark size={32} />
            <span className="text-sm leading-none">
              <span className="text-white/55 font-normal">The </span>
              <span className="text-white font-bold tracking-tight">Card </span>
              <span className="text-amber font-bold tracking-tight">Cloud</span>
            </span>
          </Link>

          {/* Nav links */}
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/65 hover:text-white hover:bg-white/8"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right: avatar dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 group"
              aria-label="Account menu"
            >
              {profilePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profilePhoto}
                  alt={displayName ?? email}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20 group-hover:ring-white/40 transition-all"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold ring-2 ring-white/20 group-hover:ring-white/40 transition-all">
                  {initials}
                </div>
              )}
              <ChevronIcon className={cn("w-3.5 h-3.5 text-white/50 transition-transform", dropdownOpen && "rotate-180")} />
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50">
                {/* User info */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-navy font-semibold text-sm truncate">
                    {displayName ?? username ?? "Collector"}
                  </p>
                  <p className="text-slate-400 text-xs truncate mt-0.5">{email}</p>
                </div>

                <Link
                  href="/dashboard/profile"
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={() => setDropdownOpen(false)}
                >
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  View profile
                </Link>
                <Link
                  href="/dashboard/consignments"
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={() => setDropdownOpen(false)}
                >
                  <BoxIcon className="w-4 h-4 text-slate-400" />
                  My Consignments
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={() => setDropdownOpen(false)}
                >
                  <SettingsIcon className="w-4 h-4 text-slate-400" />
                  Settings
                </Link>
                <Link
                  href="/support"
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={() => setDropdownOpen(false)}
                >
                  <SupportIcon className="w-4 h-4 text-slate-400" />
                  Support
                </Link>

                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-alert hover:bg-red-50 transition-colors"
                  >
                    <SignOutIcon className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CardStackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 24" fill="none" aria-hidden="true">
      <rect x="0" y="8" width="21" height="14" rx="2.5" fill="currentColor" opacity="0.3" />
      <rect x="3" y="4" width="21" height="14" rx="2.5" fill="currentColor" opacity="0.6" />
      <rect x="6" y="0" width="21" height="14" rx="2.5" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}
function SupportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
