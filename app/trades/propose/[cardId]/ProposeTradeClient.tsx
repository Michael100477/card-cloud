"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CardSummary {
  id: string;
  player: string;
  year: number;
  manufacturer: string;
  set: string;
  cardNumber: string | null;
  grade: string | null;
  gradeCompany: string | null;
  photos: string[];
}

interface TargetCard extends CardSummary {
  owner: { id: string; displayName: string | null; username: string | null };
}

export function ProposeTradeClient({ targetCard, myCards }: { targetCard: TargetCard; myCards: CardSummary[] }) {
  const router = useRouter();
  const [picked,  setPicked]  = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState("");

  function togglePick(id: string) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (picked.size === 0) {
      setErr("Pick at least one of your own cards to offer.");
      return;
    }
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCardId:    targetCard.id,
          offeredCardIds:  [...picked],
          message:         message.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `Failed (${r.status})`);
      router.push(`/trades/${d.tradeId}`);
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  }

  const ownerLabel = targetCard.owner.displayName ?? targetCard.owner.username ?? "the owner";

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-10">
      <div className="mb-6">
        <Link href="/trades" className="text-slate-400 text-sm hover:text-navy">← Back to trades</Link>
        <h1 className="text-2xl font-bold text-navy mt-2">Propose a trade</h1>
        <p className="text-slate-500 text-sm mt-1">
          Pick one or more of your tradeable cards to offer for <span className="text-navy font-medium">{targetCard.player}</span>.
        </p>
      </div>

      {/* What they're getting */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Section title={`${ownerLabel}'s card (you want this)`}>
          <CardChip card={targetCard} />
        </Section>

        <Section title={`Your offer (${picked.size} selected)`}>
          {picked.size === 0 ? (
            <p className="text-slate-400 text-sm italic">Pick from your collection below.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[...picked].map(id => {
                const c = myCards.find(x => x.id === id);
                if (!c) return null;
                return <CardChip key={id} card={c} />;
              })}
            </div>
          )}
        </Section>
      </div>

      <Section title="Pick from your tradeable cards">
        {myCards.length === 0 ? (
          <p className="text-slate-400 text-sm">
            You have no cards marked as tradeable. Mark some from{" "}
            <Link href="/dashboard" className="text-brand hover:underline">your collection</Link>.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {myCards.map(c => {
              const isPicked = picked.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => togglePick(c.id)}
                  className={`rounded-xl overflow-hidden border-2 transition-colors text-left ${isPicked ? "border-purple-600 ring-2 ring-purple-200" : "border-slate-200 hover:border-purple-300"}`}
                >
                  <div className="aspect-[3/4] bg-slate-50 relative">
                    {c.photos[0]
                      ? <img src={c.photos[0]} alt={c.player} className="w-full h-full object-contain" />
                      : <div className="w-full h-full flex items-center justify-center text-3xl text-slate-300">🃏</div>}
                    {isPicked && (
                      <div className="absolute top-1.5 right-1.5 bg-purple-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">✓</div>
                    )}
                  </div>
                  <div className="p-2 text-xs">
                    <p className="text-navy font-semibold truncate">{c.player}</p>
                    <p className="text-slate-400 truncate">{c.year} {c.set}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Optional message">
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Add a note to the seller (optional)…"
          rows={3}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </Section>

      {err && <p className="text-red-500 text-sm mb-3">{err}</p>}

      <div className="flex gap-2 justify-end">
        <Link href="/trades" className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50">
          Cancel
        </Link>
        <button
          onClick={submit}
          disabled={busy || picked.size === 0}
          className="bg-purple-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-purple-700 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send proposal"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4">
      <h2 className="text-navy font-semibold text-sm mb-3">{title}</h2>
      {children}
    </div>
  );
}

function CardChip({ card }: { card: CardSummary }) {
  return (
    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-2 max-w-xs">
      <div className="w-14 aspect-[3/4] bg-white rounded overflow-hidden flex-shrink-0">
        {card.photos[0]
          ? <img src={card.photos[0]} alt={card.player} className="w-full h-full object-contain" />
          : <div className="w-full h-full flex items-center justify-center text-xl text-slate-300">🃏</div>}
      </div>
      <div className="min-w-0">
        <p className="text-navy font-medium text-sm truncate">{card.player}</p>
        <p className="text-slate-400 text-xs truncate">{card.year} {card.set}</p>
        {card.grade && <p className="text-purple-600 text-xs font-medium">{card.gradeCompany} {card.grade}</p>}
      </div>
    </div>
  );
}
