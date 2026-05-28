"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CardSummary {
  id: string; player: string; year: number; manufacturer: string; set: string;
  cardNumber: string | null; grade: string | null; gradeCompany: string | null;
}
interface RevisionCard { cardId: string; side: string; card: CardSummary }
interface UserSummary { id: string; displayName: string | null; username: string | null; email: string }

interface AdminTrade {
  id: string;
  status: string;
  initiator: UserSummary;
  target:    UserSummary;
  initiatorInboundTracking:   string | null;
  initiatorInboundReceivedAt: string | null;
  targetInboundTracking:      string | null;
  targetInboundReceivedAt:    string | null;
  initiatorOutboundTracking:  string | null;
  initiatorOutboundShippedAt: string | null;
  initiatorReceivedAt:        string | null;
  targetOutboundTracking:     string | null;
  targetOutboundShippedAt:    string | null;
  targetReceivedAt:           string | null;
  // Dispute
  disputeOpenedById: string | null;
  disputeReason:     string | null;
  disputeOpenedAt:   string | null;
}

const name = (u: UserSummary) => u.displayName ?? u.username ?? u.email;
const fmt  = (d: string | null) => d ? new Date(d).toLocaleString() : null;

export function AdminTradeClient({ trade, initiatorCards, targetCards, focusSide }: {
  trade: AdminTrade;
  initiatorCards: RevisionCard[];
  targetCards:    RevisionCard[];
  focusSide: "initiator" | "target" | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");
  const [outboundTracking, setOutboundTracking] = useState<{ initiator: string; target: string }>({ initiator: "", target: "" });

  async function action(path: string, body?: object) {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/admin/trades/${trade.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `Failed (${r.status})`);
      router.refresh();
    } catch (e) { setErr(String(e)); }
    setBusy(false);
  }

  function Side({ side, user, cards }: { side: "initiator" | "target"; user: UserSummary; cards: RevisionCard[] }) {
    const inboundTracking   = side === "initiator" ? trade.initiatorInboundTracking   : trade.targetInboundTracking;
    const inboundReceived   = side === "initiator" ? trade.initiatorInboundReceivedAt : trade.targetInboundReceivedAt;
    const outboundTrack     = side === "initiator" ? trade.initiatorOutboundTracking  : trade.targetOutboundTracking;
    const outboundShipped   = side === "initiator" ? trade.initiatorOutboundShippedAt : trade.targetOutboundShippedAt;
    const outboundConfirmed = side === "initiator" ? trade.initiatorReceivedAt        : trade.targetReceivedAt;
    const focused           = focusSide === side;

    return (
      <div className={`bg-white rounded-2xl border-2 p-5 ${focused ? "border-purple-500 ring-2 ring-purple-200" : "border-slate-100"}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-navy font-bold">{name(user)} <span className="text-slate-400 text-xs font-normal">({side})</span></h2>
          {focused && <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded">QR target</span>}
        </div>

        {/* Cards being sent in (sender's cards on this side) */}
        <p className="text-slate-400 text-xs uppercase tracking-wide font-semibold mb-2">Cards in their shipment ({cards.length})</p>
        <ul className="text-sm flex flex-col gap-1 mb-4">
          {cards.map(c => (
            <li key={c.cardId} className="flex items-baseline justify-between border-b border-slate-100 py-1.5">
              <span className="text-navy font-medium">{c.card.player}</span>
              <span className="text-slate-400 text-xs">
                {c.card.year} {c.card.set}{c.card.cardNumber ? ` · #${c.card.cardNumber}` : ""}{c.card.grade ? ` · ${c.card.gradeCompany} ${c.card.grade}` : ""}
              </span>
            </li>
          ))}
        </ul>

        {/* Inbound (trader → Card Cloud) */}
        <div className="bg-blue-50 rounded-xl p-3 mb-3">
          <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold mb-1">Inbound shipment to Card Cloud</p>
          {inboundReceived ? (
            <p className="text-green-700 text-sm font-medium">✓ Received {fmt(inboundReceived)}</p>
          ) : inboundTracking ? (
            <>
              <p className="text-sm text-slate-600 mb-2">Tracking: <span className="font-mono text-navy">{inboundTracking}</span></p>
              <button onClick={() => action("mark-inbound-received", { side })} disabled={busy}
                className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                Mark this side received
              </button>
            </>
          ) : (
            <p className="text-slate-400 text-sm italic">Trader hasn&apos;t added tracking yet.</p>
          )}
        </div>

        {/* Outbound (Card Cloud → other trader's destination) */}
        <div className="bg-purple-50 rounded-xl p-3">
          <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold mb-1">
            Outbound shipment to {name(side === "initiator" ? trade.initiator : trade.target)}
          </p>
          {outboundConfirmed ? (
            <p className="text-green-700 text-sm font-medium">✓ Recipient confirmed receipt {fmt(outboundConfirmed)}</p>
          ) : outboundShipped ? (
            <p className="text-sm text-slate-600">
              Tracking: <span className="font-mono text-navy">{outboundTrack}</span> · Shipped {fmt(outboundShipped)}
            </p>
          ) : trade.status === "received_both" ? (
            <div className="flex flex-col gap-2">
              <input
                value={outboundTracking[side]}
                onChange={e => setOutboundTracking(p => ({ ...p, [side]: e.target.value }))}
                placeholder="Tracking number from carrier"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <button onClick={() => action("mark-outbound-shipped", { side, tracking: outboundTracking[side].trim() })}
                disabled={busy || !outboundTracking[side].trim()}
                className="self-start bg-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                Mark shipped
              </button>
            </div>
          ) : (
            <p className="text-slate-400 text-sm italic">
              {["accepted", "inbound"].includes(trade.status)
                ? "Waiting for both inbound shipments to arrive."
                : "Pending."}
            </p>
          )}
        </div>
      </div>
    );
  }

  const disputeBy =
    trade.disputeOpenedById === trade.initiator.id ? trade.initiator
    : trade.disputeOpenedById === trade.target.id  ? trade.target
    : null;

  return (
    <div>
      {err && <p className="text-red-500 text-sm mb-3">{err}</p>}

      {trade.status === "disputed" && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 mb-4">
          <h2 className="text-red-900 font-bold mb-1">⚠ Dispute open — admin review needed</h2>
          {disputeBy && <p className="text-red-800 text-sm">Opened by <strong>{name(disputeBy)}</strong>{trade.disputeOpenedAt ? ` on ${fmt(trade.disputeOpenedAt)}` : ""}.</p>}
          {trade.disputeReason && (
            <div className="mt-3 bg-white border border-red-200 rounded-xl p-3 text-sm text-red-900">
              <p className="text-xs uppercase tracking-wide font-semibold text-red-500 mb-1">Reason</p>
              {trade.disputeReason}
            </div>
          )}
          <p className="text-red-700 text-xs mt-3">
            Contact both parties directly. Resolution is currently handled outside the platform — this status will need to be flipped manually once resolved.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Side side="initiator" user={trade.initiator} cards={initiatorCards} />
        <Side side="target"    user={trade.target}    cards={targetCards} />
      </div>
    </div>
  );
}
