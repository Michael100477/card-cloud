"use client";

import { useState } from "react";

interface WatchButtonProps {
  cardId: string;
  initialWatching: boolean;
  initialCount: number;
  estimatedValue?: number | null;
}

export function WatchButton({ cardId, initialWatching, initialCount, estimatedValue }: WatchButtonProps) {
  const [watching, setWatching] = useState(initialWatching);
  const [count,    setCount]    = useState(initialCount);
  const [loading,  setLoading]  = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const r = await fetch("/api/social/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, priceAtWatch: estimatedValue ?? null }),
      });
      const data = await r.json();
      if (r.ok) { setWatching(data.watching); setCount(data.count); }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={watching ? "Remove from watchlist" : "Add to watchlist"}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 ${
        watching
          ? "bg-brand text-white border-brand hover:bg-blue-600"
          : "bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand"
      }`}
    >
      <EyeIcon className="w-4 h-4" filled={watching} />
      {watching ? "Watching" : "Watch"}
      {count > 0 && <span className={`text-xs ${watching ? "text-white/70" : "text-slate-400"}`}>{count}</span>}
    </button>
  );
}

function EyeIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {filled
        ? <><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z"/><circle cx="12" cy="12" r="3"/></>
        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
      }
    </svg>
  );
}
