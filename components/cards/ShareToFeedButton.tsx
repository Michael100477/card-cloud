"use client";

import { useState } from "react";

interface Props {
  cardId:         string;
  initialPostId:  string | null;   // null = not yet shared
  initialCaption: string | null;
}

export function ShareToFeedButton({ cardId, initialPostId, initialCaption }: Props) {
  const [postId,   setPostId]   = useState<string | null>(initialPostId);
  const [caption,  setCaption]  = useState(initialCaption ?? "");
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState(initialCaption ?? "");
  const [loading,  setLoading]  = useState(false);

  const isShared = !!postId;

  // ── Share / update caption ────────────────────────────────────────────────

  async function share() {
    setLoading(true);
    const r = await fetch("/api/feed", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, caption: draft || null }),
    });
    const d = await r.json();
    if (r.ok) { setPostId(d.postId); setCaption(draft); setEditing(false); }
    setLoading(false);
  }

  async function updateCaption() {
    if (!postId) return;
    setLoading(true);
    await fetch(`/api/feed/${postId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: draft || null }),
    });
    setCaption(draft); setEditing(false); setLoading(false);
  }

  async function unshare() {
    if (!postId || !confirm("Remove this card from your public feed?")) return;
    setLoading(true);
    await fetch(`/api/feed/${postId}`, { method: "DELETE" });
    setPostId(null); setCaption(""); setDraft(""); setEditing(false); setLoading(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isShared && !editing) {
    return (
      <button
        onClick={() => { setDraft(""); setEditing(true); }}
        className="flex items-center gap-2 w-full border border-dashed border-brand/40 text-brand text-sm font-medium py-2.5 rounded-xl hover:bg-brand/5 hover:border-brand transition-colors justify-center"
      >
        <ShareIcon className="w-4 h-4" />
        Share to your feed
      </button>
    );
  }

  if (editing) {
    return (
      <div className="border border-brand/30 rounded-xl p-3 bg-brand/5">
        <p className="text-navy text-xs font-semibold mb-2">
          {isShared ? "Edit caption" : "Share to your feed"}
        </p>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add a caption… (optional)"
          rows={3}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-navy placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
          autoFocus
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={isShared ? updateCaption : share}
            disabled={loading}
            className="flex-1 bg-brand text-white text-sm font-semibold py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "…" : isShared ? "Update" : "Share"}
          </button>
          <button
            onClick={() => { setEditing(false); setDraft(caption); }}
            className="px-3 text-slate-400 text-sm hover:text-slate-600"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Shared state
  return (
    <div className="border border-green-200 rounded-xl p-3 bg-green-50">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-green-600 text-xs font-semibold">✓ Shared to your feed</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setDraft(caption); setEditing(true); }}
            className="text-brand text-xs font-medium hover:underline"
          >
            Edit caption
          </button>
          <button
            onClick={unshare}
            disabled={loading}
            className="text-slate-400 hover:text-red-500 text-xs transition-colors disabled:opacity-50"
          >
            {loading ? "…" : "Unshare"}
          </button>
        </div>
      </div>
      {caption && (
        <p className="text-slate-600 text-sm italic">"{caption}"</p>
      )}
    </div>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}
