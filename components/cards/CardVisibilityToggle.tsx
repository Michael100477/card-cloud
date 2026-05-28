"use client";

import { useState } from "react";

interface Props {
  cardId:          string;
  initialIsPublic: boolean;
}

export function CardVisibilityToggle({ cardId, initialIsPublic }: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [loading,  setLoading]  = useState(false);

  async function toggle() {
    setLoading(true);
    const next = !isPublic;
    const r = await fetch(`/api/cards/${cardId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: next }),
    });
    if (r.ok) setIsPublic(next);
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={isPublic ? "Card is public — click to make private" : "Card is private — click to make public"}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-50 ${
        isPublic
          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
      }`}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
      ) : isPublic ? (
        <GlobeIcon className="w-3.5 h-3.5" />
      ) : (
        <LockIcon className="w-3.5 h-3.5" />
      )}
      {isPublic ? "Public" : "Private"}
    </button>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}
function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
