"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NewPostButton } from "@/components/dashboard/NewPostButton";

interface Props {
  displayName: string | null;
  username:    string | null;
  cardCount:   number;
}

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function WelcomeHeader({ displayName, username, cardCount }: Props) {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => { setHour(new Date().getHours()); }, []);

  const name = displayName ?? username ?? "Collector";
  const greet = hour !== null ? greeting(hour) : "Welcome back";

  return (
    <div className="relative overflow-hidden bg-navy rounded-2xl px-6 py-7 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* Decorative background rings */}
      <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full border border-white/5" />
      <div className="absolute -right-8 -top-8  w-48 h-48 rounded-full border border-white/5" />

      <div className="relative">
        <p className="text-sky-highlight text-sm font-medium mb-0.5">{greet}</p>
        <h1 className="text-white text-2xl sm:text-3xl font-bold">{name}</h1>
        <p className="text-white/50 text-sm mt-1">
          {cardCount === 0
            ? "Start building your collection"
            : `${cardCount.toLocaleString()} card${cardCount !== 1 ? "s" : ""} tracked`
          }
        </p>
      </div>

      {/* Quick actions */}
      <div className="relative flex flex-wrap gap-2 shrink-0">
        <Link href="/dashboard/cards/new"
          className="flex items-center gap-1.5 bg-amber text-amber-dark text-sm font-semibold px-4 py-2 rounded-xl hover:brightness-105 transition-all">
          <PlusIcon className="w-4 h-4" /> Add card
        </Link>
        <Link href="/dashboard/consign"
          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
          <BoxIcon className="w-4 h-4" /> Consign
        </Link>
        <Link href="/dashboard/watchlist"
          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
          <EyeIcon className="w-4 h-4" /> Watchlist
        </Link>
        <NewPostButton variant="ghost" />
      </div>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function BoxIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
}
function EyeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
