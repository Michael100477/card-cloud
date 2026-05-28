"use client";

import { useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommentData {
  id: string; body: string; createdAt: string;
  author: { id: string; name: string; profilePhoto: string | null };
}

interface CardData {
  id: string; player: string; year: number; manufacturer: string; set: string;
  subset: string | null; sport: string | null; grade: string | null;
  gradeCompany: string | null; serialNumber: string | null;
  tags: string[]; photos: string[]; estimatedValue: number | null;
  isWatching: boolean; commentCount: number; watcherCount: number;
  comments: CommentData[];
}

export interface PostData {
  id: string; caption: string | null; createdAt: string;
  photos: string[]; postComments: CommentData[]; postCommentCount: number;
  user: { id: string; displayName: string | null; username: string | null; profilePhoto: string | null };
  card: CardData | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SPORT_GRAD: Record<string, [string, string]> = {
  Baseball:   ["#CE1141","#041E42"], Football:   ["#8B4513","#C8A96E"],
  Basketball: ["#C9430A","#1D428A"], Hockey:     ["#003087","#C8102E"],
  "Pokémon":  ["#FF0000","#FFCB05"],
};
const GRADE_BG: Record<string, string> = {
  PSA: "#185FA5", BGS: "#1a1a1a", SGC: "#059669", CGC: "#d97706",
};

function grad(sport: string | null | undefined): [string, string] {
  return SPORT_GRAD[sport ?? ""] ?? ["#185FA5","#042C53"];
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)    return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000)return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Shared sub-components ────────────────────────────────────────────────────

function PostHeader({ user, createdAt }: { user: PostData["user"]; createdAt: string }) {
  const ownerName   = user.displayName ?? user.username ?? "Collector";
  const profileLink = user.username ? `/u/${user.username}` : "#";
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
      <Link href={profileLink} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <div className="w-9 h-9 rounded-full bg-brand/10 overflow-hidden flex items-center justify-center shrink-0">
          {user.profilePhoto
            ? <img src={user.profilePhoto} alt={ownerName} className="w-full h-full object-cover" />
            : <span className="text-brand text-sm font-bold">{ownerName[0]?.toUpperCase()}</span>
          }
        </div>
        <div>
          <p className="text-navy text-sm font-semibold leading-tight">{ownerName}</p>
          {user.username && <p className="text-slate-400 text-xs">@{user.username}</p>}
        </div>
      </Link>
      <span className="text-slate-400 text-xs">{relTime(createdAt)}</span>
    </div>
  );
}

function CommentSection({
  targetKey, targetId, initialComments, initialCount,
}: {
  targetKey: "cardId" | "feedPostId"; targetId: string;
  initialComments: CommentData[]; initialCount: number;
}) {
  const [comments,     setComments]     = useState<CommentData[]>(initialComments);
  const [commentCount, setCommentCount] = useState(initialCount);
  const [showAll,      setShowAll]      = useState(false);
  const [newComment,   setNewComment]   = useState("");
  const [posting,      setPosting]      = useState(false);

  const shownComments = showAll ? comments : comments.slice(0, 3);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setPosting(true);
    const r = await fetch("/api/comments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [targetKey]: targetId, body: newComment.trim() }),
    });
    if (r.ok) {
      const c = await r.json();
      setComments(prev => [...prev, c]);
      setCommentCount(n => n + 1);
      setNewComment("");
      setShowAll(true);
    }
    setPosting(false);
  }

  return (
    <div className="px-4 pb-4 border-t border-slate-50 pt-3">
      {commentCount > 3 && !showAll && (
        <button onClick={() => setShowAll(true)}
          className="text-slate-400 text-xs mb-2 hover:text-navy transition-colors">
          View all {commentCount} comments
        </button>
      )}
      <div className="flex flex-col gap-2 mb-3">
        {shownComments.map(c => (
          <div key={c.id} className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center shrink-0 mt-0.5">
              {c.author.profilePhoto
                ? <img src={c.author.profilePhoto} alt="" className="w-full h-full object-cover" />
                : <span className="text-slate-500 text-xs font-bold">{c.author.name[0]?.toUpperCase()}</span>
              }
            </div>
            <div className="flex-1">
              <p className="text-navy text-sm leading-snug">
                <span className="font-semibold">{c.author.name} </span>{c.body}
              </p>
              <span className="text-slate-300 text-xs">{relTime(c.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submitComment} className="flex gap-2 items-center">
        <input
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1 text-sm text-navy placeholder-slate-300 border-0 border-b border-slate-200 py-1 focus:outline-none focus:border-brand transition-colors bg-transparent"
        />
        {newComment.trim() && (
          <button type="submit" disabled={posting}
            className="text-brand text-sm font-semibold hover:text-blue-700 disabled:opacity-50 shrink-0">
            {posting ? "…" : "Post"}
          </button>
        )}
      </form>
    </div>
  );
}

// ── Photo grid for standalone posts ─────────────────────────────────────────

function PhotoGrid({ photos }: { photos: string[] }) {
  if (photos.length === 0) return null;
  if (photos.length === 1) {
    return (
      <div className="w-full aspect-[4/5] overflow-hidden bg-slate-100">
        <img src={photos[0]} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-0.5">
      {photos.map((url, i) => (
        <div
          key={i}
          className={`overflow-hidden bg-slate-100 ${
            photos.length === 3 && i === 2
              ? "col-span-2 aspect-video"
              : "aspect-square"
          }`}
        >
          <img src={url} alt="" className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  );
}

// ── Card post ─────────────────────────────────────────────────────────────────

function CardFeedPost({ post, currentUserId }: { post: PostData & { card: CardData }; currentUserId: string }) {
  const { user, card } = post;
  const [g1, g2]   = grad(card.sport);
  const gradeBg    = GRADE_BG[card.gradeCompany ?? ""] ?? "#475569";
  const ownerName  = user.displayName ?? user.username ?? "Collector";

  const [watching,  setWatching]  = useState(card.isWatching);
  const [watchCount,setWatchCount]= useState(card.watcherCount);
  const [loading,   setLoading]   = useState(false);

  async function toggleWatch() {
    setLoading(true);
    const r = await fetch("/api/social/watch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id }),
    });
    if (r.ok) {
      const d = await r.json();
      setWatching(d.watching);
      setWatchCount(d.count);
    }
    setLoading(false);
  }

  return (
    <article className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <PostHeader user={user} createdAt={post.createdAt} />

      {/* Card photo */}
      <Link href={`/dashboard/cards/${card.id}`} className="block">
        <div className="w-full aspect-[4/5] overflow-hidden bg-slate-100"
          style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
          {card.photos[0]
            ? <img src={card.photos[0]} alt={card.player} className="w-full h-full object-contain" />
            : <span className="flex items-center justify-center h-full text-white/40 text-4xl font-bold">
                {card.player.split(" ").map(w => w[0]).join("").slice(0, 2)}
              </span>
          }
        </div>
      </Link>

      {/* Action bar */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-4">
        <button onClick={toggleWatch} disabled={loading}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${watching ? "text-brand" : "text-slate-400 hover:text-navy"}`}>
          <EyeIcon className="w-5 h-5" filled={watching} />
          {watchCount > 0 && <span>{watchCount}</span>}
        </button>
        <Link href={`/dashboard/cards/${card.id}`}
          className="flex items-center gap-1.5 text-slate-400 hover:text-navy text-sm transition-colors">
          <CommentIcon className="w-5 h-5" />
          {card.commentCount > 0 && <span>{card.commentCount}</span>}
        </Link>
        <span className="ml-auto text-slate-300 text-xs font-mono">
          {card.estimatedValue ? `$${card.estimatedValue.toLocaleString()}` : "$—"}
        </span>
      </div>

      {/* Card identity */}
      <div className="px-4 pb-2">
        <Link href={`/dashboard/cards/${card.id}`}
          className="text-navy font-bold text-base hover:text-brand transition-colors block">
          {card.player}
        </Link>
        <p className="text-slate-500 text-sm">
          {[card.year, card.manufacturer, card.set].filter(Boolean).join(" · ")}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {card.grade && (
            <span className="text-white text-xs font-bold px-2 py-0.5 rounded"
              style={{ background: gradeBg }}>
              {card.gradeCompany} {card.grade}
            </span>
          )}
          {card.serialNumber && (
            <span className="text-navy text-xs font-mono bg-navy/10 px-1.5 py-0.5 rounded">{card.serialNumber}</span>
          )}
          {card.tags.slice(0, 2).map(t => (
            <span key={t} className="bg-brand/10 text-brand text-xs px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
      </div>

      {/* Caption */}
      {post.caption && (
        <div className="px-4 pb-3">
          <p className="text-navy text-sm leading-relaxed">
            <span className="font-semibold">{ownerName} </span>
            {post.caption}
          </p>
        </div>
      )}

      <CommentSection
        targetKey="cardId"
        targetId={card.id}
        initialComments={card.comments}
        initialCount={card.commentCount}
      />
    </article>
  );
}

// ── Standalone photo post ─────────────────────────────────────────────────────

function PhotoFeedPost({ post, currentUserId }: { post: PostData; currentUserId: string }) {
  const { user } = post;
  const ownerName = user.displayName ?? user.username ?? "Collector";

  return (
    <article className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <PostHeader user={user} createdAt={post.createdAt} />

      {post.photos.length > 0 && <PhotoGrid photos={post.photos} />}

      {/* Caption */}
      {post.caption && (
        <div className="px-4 pt-3 pb-2">
          <p className="text-navy text-sm leading-relaxed">
            <span className="font-semibold">{ownerName} </span>
            {post.caption}
          </p>
        </div>
      )}

      {/* Comment count indicator in action bar */}
      <div className="px-4 pt-2 pb-1 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-slate-400 text-sm">
          <CommentIcon className="w-5 h-5" />
          {post.postCommentCount > 0 && <span>{post.postCommentCount}</span>}
        </span>
      </div>

      <CommentSection
        targetKey="feedPostId"
        targetId={post.id}
        initialComments={post.postComments}
        initialCount={post.postCommentCount}
      />
    </article>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function FeedCard({ post, currentUserId }: { post: PostData; currentUserId: string }) {
  if (post.card) {
    return <CardFeedPost post={{ ...post, card: post.card }} currentUserId={currentUserId} />;
  }
  return <PhotoFeedPost post={post} currentUserId={currentUserId} />;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function EyeIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"} stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      {filled
        ? <><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z"/><circle cx="12" cy="12" r="3"/></>
        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
      }
    </svg>
  );
}

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
