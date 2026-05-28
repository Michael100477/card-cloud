"use client";

import { useState } from "react";

interface FollowButtonProps {
  type: "user" | "collection";
  targetId: string;
  targetName?: string;
  initialFollowing: boolean;
  initialCount: number;
  /** If true, renders a smaller variant without the target name */
  compact?: boolean;
}

export function FollowButton({ type, targetId, targetName, initialFollowing, initialCount, compact }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count,     setCount]     = useState(initialCount);
  const [loading,   setLoading]   = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const r = await fetch("/api/social/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, targetId }),
      });
      const data = await r.json();
      if (r.ok) { setFollowing(data.following); setCount(data.count); }
    } finally {
      setLoading(false);
    }
  }

  const label = following
    ? (compact ? "Following" : "Following")
    : (compact ? "Follow" : targetName ? `Follow ${targetName}` : "Follow");

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 text-sm font-medium rounded-xl px-3 py-2 border transition-colors disabled:opacity-50 ${
        following
          ? "bg-slate-100 text-slate-500 border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
          : "bg-white text-navy border-slate-200 hover:border-brand hover:text-brand"
      }`}
    >
      {following ? <CheckIcon className="w-3.5 h-3.5" /> : <PlusIcon className="w-3.5 h-3.5" />}
      {label}
      {count > 0 && <span className="text-xs text-slate-400 ml-0.5">{count}</span>}
    </button>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function CheckIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
