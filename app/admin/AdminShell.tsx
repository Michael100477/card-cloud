"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface NavItem {
  section?: string;
  href?:    string;
  label?:   string;
  icon?:    string;
}

const STORAGE_KEY = "admin-sidebar-collapsed";
const AUTO_COLLAPSE_BELOW_PX = 1024;  // lg breakpoint

export function AdminShell({ nav, children }: { nav: NavItem[]; children: React.ReactNode }) {
  // null = not yet decided (server render or first paint). Once mounted we
  // pull the user's saved preference; if there isn't one we auto-collapse
  // for narrow viewports.
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved === "1") setCollapsed(true);
    else if (saved === "0") setCollapsed(false);
    else setCollapsed(window.innerWidth < AUTO_COLLAPSE_BELOW_PX);
  }, []);

  // While the user hasn't manually toggled, follow viewport changes too.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) != null) return;
    const onResize = () => setCollapsed(window.innerWidth < AUTO_COLLAPSE_BELOW_PX);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  // First paint: default to expanded so server-rendered HTML matches a
  // sensible initial layout. Hydration will adjust on mount.
  const effectiveCollapsed = collapsed ?? false;
  const sidebarWidth = effectiveCollapsed ? "w-14" : "w-56";
  const mainMargin   = effectiveCollapsed ? "ml-14" : "ml-56";

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className={`${sidebarWidth} shrink-0 bg-navy flex flex-col h-screen fixed top-0 left-0 z-30 transition-[width] duration-150`}>
        {/* Header — brand + toggle */}
        <div className="px-3 py-5 border-b border-white/10 shrink-0 flex items-center justify-between gap-2">
          {!effectiveCollapsed && (
            <div className="min-w-0">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-0.5">Admin</p>
              <p className="text-white font-bold text-base truncate">Card Cloud</p>
            </div>
          )}
          <button
            onClick={toggle}
            title={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`text-white/40 hover:text-white text-base shrink-0 w-8 h-8 rounded-md hover:bg-white/8 flex items-center justify-center ${effectiveCollapsed ? "mx-auto" : ""}`}
          >
            {effectiveCollapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-4 flex flex-col gap-0.5">
          {nav.map((item, i) =>
            item.section ? (
              effectiveCollapsed ? (
                <div key={i} className="h-px bg-white/10 my-3 mx-2" />
              ) : (
                <p key={i} className="text-white/25 text-xs font-semibold uppercase tracking-widest px-3 pt-4 pb-1 first:pt-0">
                  {item.section}
                </p>
              )
            ) : (
              <Link
                key={item.href}
                href={item.href!}
                title={effectiveCollapsed ? item.label : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/8 text-sm transition-colors ${effectiveCollapsed ? "justify-center" : ""}`}
              >
                <span className="text-base leading-none w-5 text-center shrink-0">{item.icon}</span>
                {!effectiveCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            )
          )}
        </nav>

        {/* Footer — exit admin + sign out */}
        <div className="px-2 py-4 border-t border-white/10 shrink-0 flex flex-col gap-0.5">
          <Link
            href="/dashboard"
            title={effectiveCollapsed ? "Exit admin (back to dashboard)" : undefined}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white/70 text-xs transition-colors ${effectiveCollapsed ? "justify-center" : ""}`}
          >
            {effectiveCollapsed ? "←" : "← Exit admin"}
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            title={effectiveCollapsed ? "Sign out" : undefined}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white/70 text-xs transition-colors w-full text-left ${effectiveCollapsed ? "justify-center" : ""}`}
          >
            {effectiveCollapsed ? "⎋" : "⎋ Sign out"}
          </button>
        </div>
      </aside>

      {/* Main — width contained so wide children scroll inside their own card */}
      <main className={`${mainMargin} flex-1 min-w-0 min-h-screen bg-slate-100 overflow-x-hidden transition-[margin] duration-150`}>
        <div className="max-w-screen-xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
