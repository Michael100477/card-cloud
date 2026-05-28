"use client";

import { useState, useEffect, useCallback } from "react";
import { EmailDashboard } from "../email/EmailDashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailThread {
  id: string; subject: string; fromEmail: string; fromName: string | null;
  type: string; status: string; category: string | null; escalated: boolean;
  escalationReason: string | null; updatedAt: string;
  lastMessage: { role: string; body: string; sentAt: string } | null;
}

interface EmailAccount {
  id: string; label: string; host: string; port: number;
  secure: boolean; user: string; pass: string; mailbox: string; active: boolean;
}

interface EbayMsg {
  id: string; subject: string; body: string; sender: string;
  messageType: string; createdAt: string; read: boolean;
  itemId: string | null; hasResponse: boolean; status: string;
}

interface EbaySent {
  id: string; body: string; to: string; subject: string;
  sentAt: string; itemId: string | null; inReplyTo: string;
  source: "ebay" | "local";
}

interface EbayFeedback {
  id: string; commentType: "Positive" | "Neutral" | "Negative";
  commentText: string; commentingUser: string; commentTime: string;
  itemId: string | null; transactionId: string | null;
  response: string; followup: string;
}

interface FeedbackSummary {
  positiveScore: number; negativeScore: number;
  neutralScore: number; positivePercent: number;
}

interface EbayFeedbackAlertRecord {
  id: string; feedbackId: string; commentType: string;
  commentingUser: string; commentText: string;
  commentTime: string; itemId: string | null; resolvedAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function msgTypeLabel(t: string): string {
  const map: Record<string, string> = {
    AskSellerQuestion: "Question", ContactTransactionMember: "Order message", General: "General",
  };
  return map[t] ?? t.replace(/([A-Z])/g, " $1").trim();
}

const FB_COLOR: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Negative: { bg: "bg-red-900/40",   text: "text-red-400",   border: "border-red-800",   dot: "bg-red-500" },
  Neutral:  { bg: "bg-amber-900/40", text: "text-amber-400", border: "border-amber-800", dot: "bg-amber-400" },
  Positive: { bg: "bg-green-900/40", text: "text-green-400", border: "border-green-800", dot: "bg-green-500" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function MessagesClient({
  initialThreads, initialAccounts,
}: {
  initialThreads: EmailThread[]; initialAccounts: EmailAccount[];
}) {
  const [tab, setTab] = useState<"email" | "ebay" | "feedback">("email");

  // eBay messages state
  const [ebayMsgs,     setEbayMsgs]     = useState<EbayMsg[]>([]);
  const [ebaySentMsgs, setEbaySentMsgs] = useState<EbaySent[]>([]);
  const [ebayLoading,  setEbayLoading]  = useState(false);
  const [ebayError,    setEbayError]    = useState<string | null>(null);
  const [ebayLoaded,   setEbayLoaded]   = useState(false);
  const [ebaySubTab,   setEbaySubTab]   = useState<"inbox" | "sent">("inbox");
  const [selectedEbay, setSelectedEbay] = useState<EbayMsg | null>(null);
  const [selectedSent, setSelectedSent] = useState<EbaySent | null>(null);
  const [replyBody,    setReplyBody]    = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError,   setReplyError]   = useState<string | null>(null);
  const [replySent,    setReplySent]    = useState<string | null>(null);

  // Feedback state
  const [feedback,          setFeedback]          = useState<EbayFeedback[]>([]);
  const [feedbackSummary,   setFeedbackSummary]   = useState<FeedbackSummary | null>(null);
  const [fbLoading,         setFbLoading]         = useState(false);
  const [fbError,           setFbError]           = useState<string | null>(null);
  const [fbLoaded,          setFbLoaded]          = useState(false);
  const [selectedFb,        setSelectedFb]        = useState<EbayFeedback | null>(null);
  const [fbFilter,          setFbFilter]          = useState<"all" | "Negative" | "Neutral" | "Positive">("all");
  const [unresolvedAlerts,  setUnresolvedAlerts]  = useState<EbayFeedbackAlertRecord[]>([]);
  const [resolving,         setResolving]         = useState<string | null>(null);

  const loadEbay = useCallback(async () => {
    setEbayLoading(true); setEbayError(null);
    try {
      const r = await fetch("/api/admin/ebay/messages");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to load eBay messages");
      setEbayMsgs(d.messages ?? []);
      setEbaySentMsgs(d.sent ?? []);
    } catch (e) { setEbayError(String(e)); }
    finally { setEbayLoading(false); setEbayLoaded(true); }
  }, []);

  // Load unresolved alerts on mount (drives the badge — independent of feedback tab)
  useEffect(() => {
    fetch("/api/admin/ebay/feedback/alerts")
      .then(r => r.json())
      .then(d => setUnresolvedAlerts(d.alerts ?? []))
      .catch(console.error);
  }, []);

  const resolveAlert = useCallback(async (alertId: string) => {
    setResolving(alertId);
    try {
      const r = await fetch("/api/admin/ebay/feedback/alerts", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: alertId }),
      });
      if (r.ok) setUnresolvedAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (e) { console.error(e); }
    finally { setResolving(null); }
  }, []);

  const loadFeedback = useCallback(async () => {
    setFbLoading(true); setFbError(null);
    try {
      const r = await fetch("/api/admin/ebay/feedback");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to load feedback");
      setFeedback(d.feedback ?? []);
      setFeedbackSummary(d.summary ?? null);
    } catch (e) { setFbError(String(e)); }
    finally { setFbLoading(false); setFbLoaded(true); }
  }, []);

  useEffect(() => {
    if (tab === "ebay"     && !ebayLoaded && !ebayLoading) loadEbay();
    if (tab === "feedback" && !fbLoaded   && !fbLoading)   loadFeedback();
  }, [tab, ebayLoaded, ebayLoading, loadEbay, fbLoaded, fbLoading, loadFeedback]);

  const sendReply = useCallback(async () => {
    if (!selectedEbay || !replyBody.trim()) return;
    setReplySending(true); setReplyError(null);
    try {
      const r = await fetch("/api/admin/ebay/messages/reply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: selectedEbay.id, itemId: selectedEbay.itemId,
          body: replyBody.trim(), recipientId: selectedEbay.sender, subject: selectedEbay.subject,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to send reply");
      setReplySent(selectedEbay.id); setReplyBody(""); setEbayLoaded(false);
    } catch (e) { setReplyError(String(e)); }
    finally { setReplySending(false); }
  }, [selectedEbay, replyBody]);

  const negNeutralCount = unresolvedAlerts.length;
  const filteredFeedback = fbFilter === "all" ? feedback : feedback.filter(f => f.commentType === fbFilter);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">Messages</h1>
      <p className="text-slate-400 text-sm mb-6">Unified inbox — support email, eBay messages, and seller feedback.</p>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-slate-200 p-1 rounded-xl w-fit mb-6">
        {(["email", "ebay", "feedback"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative px-5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
            {t === "email"    ? "✉️  Support Email"
             : t === "ebay"   ? "🛒  eBay Messages"
             : "⭐  Feedback"}
            {t === "feedback" && negNeutralCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {negNeutralCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Email tab ── */}
      {tab === "email" && (
        <div className="bg-slate-900 rounded-2xl p-6">
          <EmailDashboard threads={initialThreads} initialAccounts={initialAccounts} />
        </div>
      )}

      {/* ── eBay Messages tab ── */}
      {tab === "ebay" && (
        <div className="bg-slate-900 rounded-2xl p-6">
          <div className="flex gap-6">
            <div className="w-80 shrink-0 flex flex-col gap-3">
              <div className="flex gap-1 bg-slate-900 p-1 rounded-lg">
                {(["inbox", "sent"] as const).map(st => (
                  <button key={st} onClick={() => setEbaySubTab(st)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${ebaySubTab === st ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>
                    {st === "inbox"
                      ? `Inbox${ebayLoaded && ebayMsgs.length > 0 ? ` (${ebayMsgs.length})` : ""}`
                      : `Sent${ebayLoaded && ebaySentMsgs.length > 0 ? ` (${ebaySentMsgs.length})` : ""}`}
                  </button>
                ))}
              </div>

              {ebayLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-sm px-1">
                  <div className="w-4 h-4 border-2 border-slate-600 border-t-brand rounded-full animate-spin" />
                  Loading eBay messages…
                </div>
              )}
              {ebayError && (
                <div className="bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
                  <p className="text-red-400 text-sm font-semibold">Could not load eBay messages</p>
                  <p className="text-red-300/70 text-xs mt-1">{ebayError}</p>
                  <button onClick={loadEbay} className="mt-2 text-brand text-xs font-semibold hover:underline">Retry</button>
                </div>
              )}

              {ebaySubTab === "inbox" && !ebayLoading && !ebayError && (
                <>
                  {ebayMsgs.length === 0
                    ? <p className="text-slate-600 text-sm">No eBay messages in the last 30 days.</p>
                    : ebayMsgs.map(m => (
                        <button key={m.id} onClick={() => { setSelectedEbay(m); setSelectedSent(null); setReplyBody(""); setReplyError(null); }}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedEbay?.id === m.id ? "bg-slate-700 border-slate-600" : "border-transparent hover:bg-slate-800"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-white text-sm font-medium truncate">{m.subject}</p>
                            {!m.read && <span className="shrink-0 w-2 h-2 rounded-full bg-brand mt-1" />}
                          </div>
                          <p className="text-slate-400 text-xs truncate mt-0.5">{m.sender}</p>
                          <p className="text-slate-500 text-xs mt-1">{fmtDate(m.createdAt)}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{msgTypeLabel(m.messageType)}</span>
                            {m.status === "Unanswered"
                              ? <span className="text-[10px] bg-amber-900/40 text-amber-400 border border-amber-800 px-1.5 py-0.5 rounded">Needs reply</span>
                              : <span className="text-[10px] bg-green-900/40 text-green-400 border border-green-800 px-1.5 py-0.5 rounded">Replied</span>
                            }
                          </div>
                        </button>
                      ))
                  }
                </>
              )}

              {ebaySubTab === "sent" && !ebayLoading && !ebayError && (
                <>
                  {ebaySentMsgs.length === 0
                    ? <p className="text-slate-600 text-sm">No sent messages found.</p>
                    : ebaySentMsgs.map(s => (
                        <button key={s.id} onClick={() => { setSelectedSent(s); setSelectedEbay(null); }}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedSent?.id === s.id ? "bg-slate-700 border-slate-600" : "border-transparent hover:bg-slate-800"}`}>
                          <p className="text-white text-sm font-medium truncate">{s.subject}</p>
                          <p className="text-slate-400 text-xs truncate mt-0.5">To: {s.to}</p>
                          <p className="text-slate-500 text-xs mt-1">{fmtDate(s.sentAt)}</p>
                          {s.itemId && <p className="text-slate-600 text-xs mt-0.5">Item #{s.itemId}</p>}
                          <div className="mt-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${s.source === "ebay" ? "bg-blue-900/40 text-blue-400 border-blue-800" : "bg-slate-700 text-slate-400 border-slate-600"}`}>
                              {s.source === "ebay" ? "From eBay" : "Sent via dashboard"}
                            </span>
                          </div>
                        </button>
                      ))
                  }
                </>
              )}

              {!ebayLoading && (ebayMsgs.length > 0 || ebaySentMsgs.length > 0) && (
                <button onClick={() => { setEbayLoaded(false); setSelectedEbay(null); setSelectedSent(null); }}
                  className="text-slate-500 hover:text-slate-300 text-xs text-left px-1 transition-colors mt-1">
                  Refresh
                </button>
              )}
            </div>

            <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700">
              {ebaySubTab === "inbox" && !selectedEbay && (
                <div className="p-8 text-center text-slate-500 text-sm">Select a message to view.</div>
              )}
              {ebaySubTab === "inbox" && selectedEbay && (
                <div className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-slate-700">
                    <div>
                      <h2 className="text-white font-semibold">{selectedEbay.subject}</h2>
                      <p className="text-slate-400 text-sm mt-0.5">From: {selectedEbay.sender}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{msgTypeLabel(selectedEbay.messageType)}</span>
                        {selectedEbay.hasResponse && <span className="text-xs bg-green-900/40 text-green-400 border border-green-800 px-2 py-0.5 rounded">You replied</span>}
                        {!selectedEbay.read && <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-800 px-2 py-0.5 rounded">Unread</span>}
                        {selectedEbay.itemId && (
                          <a href={`https://www.ebay.com/itm/${selectedEbay.itemId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
                            Item #{selectedEbay.itemId} ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-500 text-xs shrink-0">{fmtDate(selectedEbay.createdAt)}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto mb-4">
                    <div className="bg-slate-900 rounded-xl p-4 text-sm">
                      <pre className="text-slate-200 whitespace-pre-wrap leading-relaxed">{selectedEbay.body}</pre>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-700">
                    {replySent === selectedEbay.id ? (
                      <div className="bg-green-900/20 border border-green-800 rounded-xl px-4 py-3 flex items-center justify-between">
                        <span className="text-green-400 text-sm font-semibold">Reply sent successfully</span>
                        <button onClick={() => setReplySent(null)} className="text-green-500 text-xs hover:underline">Reply again</button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Reply to {selectedEbay.sender}</label>
                        <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Type your reply…" rows={4}
                          className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand/40 placeholder-slate-500" />
                        {replyError && <p className="text-red-400 text-xs">{replyError}</p>}
                        <div className="flex items-center justify-between">
                          <a href="https://messages.ebay.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 text-xs transition-colors">Open on eBay ↗</a>
                          <button onClick={sendReply} disabled={replySending || !replyBody.trim()}
                            className="bg-brand text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50">
                            {replySending ? "Sending…" : "Send Reply"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {ebaySubTab === "sent" && !selectedSent && (
                <div className="p-8 text-center text-slate-500 text-sm">Select a sent message to view.</div>
              )}
              {ebaySubTab === "sent" && selectedSent && (
                <div className="p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-slate-700">
                    <div>
                      <h2 className="text-white font-semibold">{selectedSent.subject}</h2>
                      <p className="text-slate-400 text-sm mt-0.5">To: {selectedSent.to}</p>
                      {selectedSent.itemId && (
                        <a href={`https://www.ebay.com/itm/${selectedSent.itemId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline mt-1 inline-block">
                          Item #{selectedSent.itemId} ↗
                        </a>
                      )}
                    </div>
                    <span className="text-slate-500 text-xs shrink-0">{fmtDate(selectedSent.sentAt)}</span>
                  </div>
                  {selectedSent.inReplyTo && (
                    <div className="mb-4 bg-slate-900 border-l-4 border-slate-600 rounded-r-lg px-4 py-3">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">In reply to</p>
                      <p className="text-slate-400 text-sm italic">{selectedSent.inReplyTo}{selectedSent.inReplyTo.length >= 200 ? "…" : ""}</p>
                    </div>
                  )}
                  <div className="bg-slate-700 rounded-xl p-4 text-sm">
                    <pre className="text-slate-200 whitespace-pre-wrap leading-relaxed">{selectedSent.body}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback tab ── */}
      {tab === "feedback" && (
        <div className="bg-slate-900 rounded-2xl p-6">

          {/* Alert banner for unresolved negative/neutral */}
          {negNeutralCount > 0 && (
            <div className="flex items-center gap-3 bg-red-900/30 border border-red-700 rounded-xl px-5 py-3 mb-5">
              <span className="text-red-400 text-lg">⚠️</span>
              <div className="flex-1">
                <p className="text-red-300 font-semibold text-sm">
                  {negNeutralCount} unresolved {negNeutralCount === 1 ? "negative feedback entry requires" : "negative feedback entries require"} your attention — respond on eBay and mark each as resolved below.
                </p>
              </div>
              <a href="https://www.ebay.com/myb/FeedbackProfile" target="_blank" rel="noopener noreferrer"
                className="shrink-0 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors">
                Respond on eBay →
              </a>
            </div>
          )}

          <div className="flex gap-6">
            {/* Left panel */}
            <div className="w-80 shrink-0 flex flex-col gap-3">

              {/* Score summary */}
              {feedbackSummary && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-white text-2xl font-bold">{feedbackSummary.positivePercent.toFixed(1)}%</span>
                    <span className="text-slate-400 text-xs">Positive feedback</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${feedbackSummary.positivePercent}%` }} />
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-green-400 text-xs"><span className="font-semibold">{feedbackSummary.positiveScore}</span> positive</span>
                    {feedbackSummary.neutralScore  > 0 && <span className="text-amber-400 text-xs"><span className="font-semibold">{feedbackSummary.neutralScore}</span> neutral</span>}
                    {feedbackSummary.negativeScore > 0 && <span className="text-red-400 text-xs"><span className="font-semibold">{feedbackSummary.negativeScore}</span> negative</span>}
                  </div>
                </div>
              )}

              {/* Filter pills */}
              {fbLoaded && feedback.length > 0 && (
                <div className="flex gap-1 bg-slate-900 p-1 rounded-lg">
                  {(["all", "Negative", "Neutral", "Positive"] as const).map(f => (
                    <button key={f} onClick={() => { setFbFilter(f); setSelectedFb(null); }}
                      className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-colors ${fbFilter === f ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>
                      {f === "all" ? "All" : f}
                    </button>
                  ))}
                </div>
              )}

              {fbLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-sm px-1">
                  <div className="w-4 h-4 border-2 border-slate-600 border-t-brand rounded-full animate-spin" />
                  Loading feedback…
                </div>
              )}
              {fbError && (
                <div className="bg-red-900/20 border border-red-800 rounded-xl px-4 py-3">
                  <p className="text-red-400 text-sm font-semibold">Could not load feedback</p>
                  <p className="text-red-300/70 text-xs mt-1">{fbError}</p>
                  <button onClick={loadFeedback} className="mt-2 text-brand text-xs font-semibold hover:underline">Retry</button>
                </div>
              )}

              {/* Feedback list */}
              {!fbLoading && !fbError && (
                <>
                  {filteredFeedback.length === 0 && fbLoaded
                    ? <p className="text-slate-600 text-sm px-1">{fbFilter === "all" ? "No feedback found." : `No ${fbFilter.toLowerCase()} feedback.`}</p>
                    : filteredFeedback.map(fb => {
                        const c = FB_COLOR[fb.commentType] ?? FB_COLOR.Positive;
                        return (
                          <button key={fb.id} onClick={() => setSelectedFb(fb)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedFb?.id === fb.id ? "bg-slate-700 border-slate-600" : "border-transparent hover:bg-slate-800"}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${c.bg} ${c.text} ${c.border}`}>
                                {fb.commentType}
                              </span>
                              {!fb.response && fb.commentType !== "Positive" && (
                                <span className="text-[10px] bg-red-900/30 text-red-400 border border-red-800 px-1.5 py-0.5 rounded">No response</span>
                              )}
                            </div>
                            <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">{fb.commentText || "(no comment)"}</p>
                            <p className="text-slate-500 text-xs mt-1">from {fb.commentingUser}</p>
                            <p className="text-slate-600 text-xs mt-0.5">{fmtDate(fb.commentTime)}</p>
                          </button>
                        );
                      })
                  }
                  {fbLoaded && feedback.length > 0 && (
                    <button onClick={() => { setFbLoaded(false); setSelectedFb(null); }}
                      className="text-slate-500 hover:text-slate-300 text-xs text-left px-1 transition-colors mt-1">
                      Refresh
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Right panel */}
            <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700">
              {!selectedFb ? (
                <div className="p-8 text-center text-slate-500 text-sm">Select a feedback entry to view details.</div>
              ) : (
                <div className="p-5 flex flex-col gap-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-700">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {(() => {
                          const c = FB_COLOR[selectedFb.commentType] ?? FB_COLOR.Positive;
                          return (
                            <span className={`text-sm font-bold px-3 py-1 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
                              {selectedFb.commentType}
                            </span>
                          );
                        })()}
                        {!selectedFb.response && selectedFb.commentType !== "Positive" && (
                          <span className="text-xs bg-red-900/30 text-red-400 border border-red-700 px-2 py-0.5 rounded-full">No public response yet</span>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm">From: <span className="text-white font-medium">{selectedFb.commentingUser}</span></p>
                      {selectedFb.itemId && (
                        <a href={`https://www.ebay.com/itm/${selectedFb.itemId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline mt-1 inline-block">
                          Item #{selectedFb.itemId} ↗
                        </a>
                      )}
                    </div>
                    <span className="text-slate-500 text-xs shrink-0">{fmtDate(selectedFb.commentTime)}</span>
                  </div>

                  {/* Feedback comment */}
                  <div className="bg-slate-900 rounded-xl p-4">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Feedback left by buyer</p>
                    <p className="text-slate-200 text-sm leading-relaxed italic">"{selectedFb.commentText || "(no comment left)"}"</p>
                  </div>

                  {/* Your response */}
                  {selectedFb.response && (
                    <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4">
                      <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wide mb-2">Your public response</p>
                      <p className="text-slate-300 text-sm leading-relaxed">"{selectedFb.response}"</p>
                    </div>
                  )}

                  {/* Followup */}
                  {selectedFb.followup && (
                    <div className="bg-slate-700/50 rounded-xl p-4">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Buyer follow-up</p>
                      <p className="text-slate-300 text-sm leading-relaxed italic">"{selectedFb.followup}"</p>
                    </div>
                  )}

                  {/* Action footer */}
                  {selectedFb.commentType !== "Positive" && (() => {
                    const activeAlert = unresolvedAlerts.find(a => a.feedbackId === selectedFb.id);
                    return (
                      <div className="pt-4 border-t border-slate-700 flex flex-col gap-3">
                        {!selectedFb.response && (
                          <p className="text-amber-400 text-xs font-medium">
                            You have up to 90 days from the feedback date to post a public reply on eBay.
                          </p>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          <a href="https://www.ebay.com/myb/FeedbackProfile" target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-600 transition-colors">
                            {selectedFb.response ? "View on eBay ↗" : "Respond on eBay →"}
                          </a>
                          {activeAlert && (
                            <button onClick={() => resolveAlert(activeAlert.id)} disabled={resolving === activeAlert.id}
                              className="inline-flex items-center gap-1.5 bg-green-800/60 hover:bg-green-700/60 border border-green-700 text-green-300 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50">
                              {resolving === activeAlert.id ? "Resolving…" : "✓ Mark resolved"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
