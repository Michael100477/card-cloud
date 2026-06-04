"use client";

import { useState } from "react";

interface Props {
  open:           boolean;
  onClose:        () => void;
  itemId:         string;
  recipientId:    string;
  cardTitle:      string;
  defaultSubject?: string;
}

export function MessageBuyerModal({
  open, onClose, itemId, recipientId, cardTitle, defaultSubject,
}: Props) {
  const [subject, setSubject] = useState(defaultSubject ?? `About your purchase: ${cardTitle.slice(0, 60)}`);
  const [body,    setBody]    = useState("");
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState("");
  const [sent,    setSent]    = useState(false);

  if (!open) return null;

  async function send() {
    setSending(true); setError("");
    try {
      const r = await fetch("/api/admin/ebay/messages/send", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ itemId, recipientId, subject, body }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `Failed (${r.status})`);
      setSent(true);
    } catch (e) {
      setError(String(e));
    }
    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-navy font-bold text-base">Message buyer</h2>
            <p className="text-slate-400 text-xs mt-0.5">{recipientId} · eBay #{itemId}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-navy text-xl leading-none" aria-label="Close">×</button>
        </div>
        {sent ? (
          <div className="px-5 py-8 text-center">
            <p className="text-green-700 font-semibold text-sm mb-1">Message sent</p>
            <p className="text-slate-500 text-xs">eBay delivered your message to {recipientId}.</p>
            <button onClick={onClose} className="mt-4 bg-brand text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-600">Done</button>
          </div>
        ) : (
          <div className="px-5 py-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Subject</span>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                disabled={sending}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Message</span>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={sending}
                rows={7}
                placeholder="Type your message to the buyer…"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand resize-y"
              />
            </label>
            <p className="text-slate-400 text-xs">eBay sends this through the My Messages system. Don&apos;t share contact info or offer off-eBay deals — that violates eBay&apos;s seller policies.</p>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} disabled={sending}
                className="text-slate-500 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={send} disabled={sending || !subject.trim() || !body.trim()}
                className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50">
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
