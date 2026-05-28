"use client";

import { useEffect, useRef, useState } from "react";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; profilePhoto: string | null };
}

interface CommentSectionProps {
  cardId?: string;
  collectionId?: string;
  currentUserId: string;
  isOwner: boolean;
}

export function CommentSection({ cardId, collectionId, currentUserId, isOwner }: CommentSectionProps) {
  const [comments, setComments]   = useState<Comment[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [body,     setBody]       = useState("");
  const [posting,  setPosting]    = useState(false);
  const [error,    setError]      = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const queryParam = cardId ? `cardId=${cardId}` : `collectionId=${collectionId}`;

  useEffect(() => {
    fetch(`/api/comments?${queryParam}`)
      .then(r => r.json())
      .then(data => { setComments(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [queryParam]);

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true); setError("");
    try {
      const r = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, collectionId, body: body.trim() }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Failed to post"); }
      else {
        setComments(prev => [...prev, data]);
        setBody("");
        textareaRef.current?.focus();
      }
    } catch { setError("Network error"); }
    setPosting(false);
  }

  async function deleteComment(id: string) {
    await fetch("/api/comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setComments(prev => prev.filter(c => c.id !== id));
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString();
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Comments {!loading && comments.length > 0 ? `(${comments.length})` : ""}
      </h2>

      {/* Comment list */}
      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-slate-400 text-sm mb-4">No comments yet. Be the first!</p>
      ) : (
        <div className="flex flex-col gap-4 mb-5">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3 group">
              {/* Avatar */}
              <div className="shrink-0 w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
                {c.author.profilePhoto
                  ? <img src={c.author.profilePhoto} alt={c.author.name} className="w-full h-full object-cover" />
                  : <span className="text-slate-500 text-xs font-bold">{c.author.name.slice(0, 1).toUpperCase()}</span>
                }
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-navy text-sm font-semibold">{c.author.name}</span>
                  <span className="text-slate-400 text-xs">{formatTime(c.createdAt)}</span>
                  {(c.author.id === currentUserId || isOwner) && (
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="text-slate-300 hover:text-red-400 text-xs ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="text-slate-700 text-sm mt-0.5 leading-relaxed whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New comment form */}
      <form onSubmit={postComment} className="flex gap-3 items-start border-t border-slate-100 pt-4">
        <div className="shrink-0 w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center">
          <span className="text-navy text-xs font-bold">You</span>
        </div>
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { postComment(e); } }}
            placeholder="Add a comment… (Ctrl+Enter to post)"
            rows={2}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          <div className="flex justify-end mt-1.5">
            <button
              type="submit"
              disabled={!body.trim() || posting}
              className="bg-navy text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-navy/80 disabled:opacity-40 transition-colors"
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
