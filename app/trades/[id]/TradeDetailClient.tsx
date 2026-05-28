"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CardSummary {
  id: string; player: string; year: number; manufacturer: string; set: string;
  cardNumber: string | null; grade: string | null; gradeCompany: string | null;
  photos: string[]; estimatedValue?: number | null;
}

interface RevisionCard {
  cardId: string;
  side: string;       // "initiator" | "target"
  card: CardSummary;
}

interface Revision {
  id: string;
  createdAt: string;
  message: string | null;
  proposedById: string;
  proposedBy: { id: string; displayName: string | null; username: string | null };
  cards: RevisionCard[];
}

interface Trade {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  initiatorId: string;
  initiator: { id: string; displayName: string | null; username: string | null };
  targetId: string;
  target: { id: string; displayName: string | null; username: string | null };
  currentRevisionId: string | null;
  revisions: Revision[];
  // Inbound — traders shipping TO Card Cloud
  initiatorInboundTracking: string | null;
  initiatorInboundReceivedAt: Date | string | null;
  targetInboundTracking: string | null;
  targetInboundReceivedAt: Date | string | null;
  // Outbound — Card Cloud shipping OUT to traders
  initiatorOutboundTracking: string | null;
  initiatorOutboundShippedAt: Date | string | null;
  initiatorReceivedAt: Date | string | null;
  targetOutboundTracking: string | null;
  targetOutboundShippedAt: Date | string | null;
  targetReceivedAt: Date | string | null;
  // Dispute
  disputeOpenedById: string | null;
  disputeReason: string | null;
  disputeOpenedAt: Date | string | null;
}

const STATUS_LABEL: Record<string, string> = {
  proposed: "Awaiting response", counter: "Counter-offer made", accepted: "Accepted",
  inbound: "Cards shipping to Card Cloud", received_both: "Card Cloud has both shipments",
  outbound: "Shipping out from Card Cloud", complete: "Complete",
  declined: "Declined", cancelled: "Cancelled", disputed: "Dispute open",
};

export function TradeDetailClient({ trade, myId, myTradeableCards }: { trade: Trade; myId: string; myTradeableCards: Omit<CardSummary, "estimatedValue">[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterMine, setCounterMine] = useState<Set<string>>(new Set());
  const [counterTheirs, setCounterTheirs] = useState<Set<string>>(new Set());
  const [counterMessage, setCounterMessage] = useState("");

  const iAmInitiator = trade.initiatorId === myId;
  const mySide       = iAmInitiator ? "initiator" : "target";
  const theirSide    = iAmInitiator ? "target" : "initiator";
  const other        = iAmInitiator ? trade.target : trade.initiator;
  const otherName    = other.displayName ?? other.username ?? "Anon";

  const current = trade.revisions.find(r => r.id === trade.currentRevisionId) ?? trade.revisions[0];
  const myCardsOnTable    = current?.cards.filter(c => c.side === mySide)    ?? [];
  const theirCardsOnTable = current?.cards.filter(c => c.side === theirSide) ?? [];

  // The party whose turn it is = the one who DID NOT propose the current revision.
  const ballInMyCourt = current?.proposedById !== myId && ["proposed", "counter"].includes(trade.status);
  const canCancel     = current?.proposedById === myId && ["proposed", "counter"].includes(trade.status);

  // Cards I can pull from for a counter (mine + cards in the current target side, in case I want to ask for fewer of theirs)
  const theirCatalog = theirCardsOnTable.map(c => c.card);

  async function action(path: string, body?: object) {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/trades/${trade.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `Failed (${r.status})`);
      router.refresh();
    } catch (e) {
      setErr(String(e));
    }
    setBusy(false);
  }

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  }

  function submitCounter() {
    if (counterMine.size === 0 || counterTheirs.size === 0) {
      setErr("Pick at least one card on each side for a counter-offer.");
      return;
    }
    action("counter", {
      mySideCardIds:    [...counterMine],
      theirSideCardIds: [...counterTheirs],
      message:          counterMessage.trim() || null,
    });
  }

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-10">
      <Link href="/trades/my" className="text-slate-400 text-sm hover:text-navy">← Back to my trades</Link>

      <div className="flex items-end justify-between mt-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Trade with {otherName}</h1>
          <p className="text-slate-400 text-sm mt-0.5">Last updated {new Date(trade.updatedAt).toLocaleString()}</p>
        </div>
        <span className="text-sm font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700">
          {STATUS_LABEL[trade.status] ?? trade.status}
        </span>
      </div>

      {/* Current offer on the table */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Panel title={`You give (${myCardsOnTable.length})`}>
          {myCardsOnTable.length === 0 ? <Empty /> :
            <div className="flex flex-wrap gap-2">{myCardsOnTable.map(c => <Chip key={c.cardId} card={c.card} />)}</div>}
        </Panel>
        <Panel title={`You get (${theirCardsOnTable.length})`}>
          {theirCardsOnTable.length === 0 ? <Empty /> :
            <div className="flex flex-wrap gap-2">{theirCardsOnTable.map(c => <Chip key={c.cardId} card={c.card} />)}</div>}
        </Panel>
      </div>

      {current?.message && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
          <p className="text-amber-800 text-sm font-medium">
            Message from {current.proposedById === myId ? "you" : otherName}:
          </p>
          <p className="text-amber-900 text-sm mt-1 italic">&ldquo;{current.message}&rdquo;</p>
        </div>
      )}

      {err && <p className="text-red-500 text-sm mb-3">{err}</p>}

      {/* Actions */}
      {ballInMyCourt && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6">
          <h2 className="text-navy font-semibold mb-3">What would you like to do?</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => action("accept")} disabled={busy}
              className="bg-green-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-green-700 disabled:opacity-50">
              {busy ? "…" : "Accept this offer"}
            </button>
            <button onClick={() => setCounterOpen(o => !o)} disabled={busy}
              className="border border-purple-300 text-purple-700 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-purple-50 disabled:opacity-50">
              {counterOpen ? "Cancel counter" : "Counter-offer"}
            </button>
            <button onClick={() => { if (confirm("Decline this trade? It cannot be reopened.")) action("decline"); }} disabled={busy}
              className="border border-slate-200 text-slate-500 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-slate-50 disabled:opacity-50">
              Decline
            </button>
          </div>

          {counterOpen && (
            <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
              <CounterPicker
                title={`Of theirs you want (${counterTheirs.size})`}
                pool={theirCatalog}
                picked={counterTheirs}
                onToggle={id => toggle(counterTheirs, setCounterTheirs, id)}
                emptyHint="You can only counter using cards already on the table from their side."
              />
              <CounterPicker
                title={`Of yours you'll give (${counterMine.size})`}
                pool={myTradeableCards}
                picked={counterMine}
                onToggle={id => toggle(counterMine, setCounterMine, id)}
                emptyHint="You have no tradeable cards. Mark some from your collection first."
              />
              <textarea
                value={counterMessage}
                onChange={e => setCounterMessage(e.target.value)}
                placeholder="Optional note with your counter…"
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <button onClick={submitCounter} disabled={busy}
                className="self-end bg-purple-600 text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-purple-700 disabled:opacity-50">
                {busy ? "Sending…" : "Send counter-offer"}
              </button>
            </div>
          )}
        </div>
      )}

      {canCancel && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6">
          <h2 className="text-navy font-semibold mb-1">Waiting for {otherName}</h2>
          <p className="text-slate-400 text-sm mb-3">Your offer is on the table. You can cancel it any time before they respond.</p>
          <button onClick={() => { if (confirm("Cancel this trade?")) action("cancel"); }} disabled={busy}
            className="border border-slate-200 text-slate-500 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-slate-50 disabled:opacity-50">
            Cancel proposal
          </button>
        </div>
      )}

      {trade.status === "disputed" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
          <h2 className="text-red-900 font-semibold mb-1">Dispute open</h2>
          {trade.disputeOpenedById === myId
            ? <p className="text-red-800 text-sm">You opened this dispute. The Card Cloud admin will follow up.</p>
            : <p className="text-red-800 text-sm">{otherName} opened a dispute on this trade. The Card Cloud admin will reach out to both parties.</p>}
          {trade.disputeReason && (
            <div className="mt-3 bg-white border border-red-200 rounded-xl p-3 text-sm text-red-900">
              <p className="text-xs uppercase tracking-wide font-semibold text-red-500 mb-1">Reason</p>
              {trade.disputeReason}
            </div>
          )}
        </div>
      )}

      {["accepted", "inbound", "received_both", "outbound"].includes(trade.status) && (
        <ShipmentSection trade={trade} myId={myId} otherName={otherName} iAmInitiator={iAmInitiator} onAction={action} busy={busy} />
      )}

      {/* Dispute button — only available once Card Cloud has shipped my cards (so there's something to dispute) */}
      {trade.status === "outbound" && (
        <DisputeButton trade={trade} myId={myId} onAction={action} busy={busy} />
      )}

      {/* History */}
      {trade.revisions.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-navy font-semibold mb-3">History</h2>
          <ul className="flex flex-col gap-2 text-xs">
            {trade.revisions.slice().reverse().map(r => (
              <li key={r.id} className="text-slate-500">
                {new Date(r.createdAt).toLocaleString()} — <span className="text-navy font-medium">
                  {r.proposedById === myId ? "You" : (r.proposedBy.displayName ?? r.proposedBy.username ?? "Other")}
                </span>{" "}
                proposed {r.cards.filter(c => c.side === "initiator").length} for {r.cards.filter(c => c.side === "target").length}
                {r.id === current?.id && <span className="ml-2 text-purple-600 font-semibold">(current)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <h3 className="text-navy font-semibold text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Empty() { return <p className="text-slate-400 text-sm italic">No cards.</p>; }

function Chip({ card }: { card: CardSummary }) {
  return (
    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1.5 max-w-[220px]">
      <div className="w-10 aspect-[3/4] bg-white rounded overflow-hidden flex-shrink-0">
        {card.photos[0]
          ? <img src={card.photos[0]} alt={card.player} className="w-full h-full object-contain" />
          : <div className="w-full h-full flex items-center justify-center text-xs text-slate-300">🃏</div>}
      </div>
      <div className="min-w-0">
        <p className="text-navy font-medium text-xs truncate">{card.player}</p>
        <p className="text-slate-400 text-[10px] truncate">{card.year} {card.set}</p>
      </div>
    </div>
  );
}

function CounterPicker({ title, pool, picked, onToggle, emptyHint }: {
  title: string; pool: Omit<CardSummary, "estimatedValue">[]; picked: Set<string>;
  onToggle: (id: string) => void; emptyHint: string;
}) {
  return (
    <div>
      <h3 className="text-navy font-semibold text-xs mb-2">{title}</h3>
      {pool.length === 0 ? <p className="text-slate-400 text-xs italic">{emptyHint}</p> :
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {pool.map(c => {
            const isPicked = picked.has(c.id);
            return (
              <button key={c.id} type="button" onClick={() => onToggle(c.id)}
                className={`rounded-lg overflow-hidden border-2 ${isPicked ? "border-purple-600 ring-2 ring-purple-200" : "border-slate-200 hover:border-purple-300"}`}>
                <div className="aspect-[3/4] bg-slate-50">
                  {c.photos[0]
                    ? <img src={c.photos[0]} alt={c.player} className="w-full h-full object-contain" />
                    : <div className="w-full h-full flex items-center justify-center text-xl text-slate-300">🃏</div>}
                </div>
                <div className="p-1 text-[10px]">
                  <p className="text-navy font-semibold truncate">{c.player}</p>
                </div>
              </button>
            );
          })}
        </div>}
    </div>
  );
}

function DisputeButton({ trade, myId, onAction, busy }: {
  trade: Trade; myId: string;
  onAction: (path: string, body?: object) => void; busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const iAmInitiator = trade.initiatorId === myId;
  // Only show the button if my outbound shipment has gone out and I haven't confirmed receipt yet
  const myOutboundShipped = iAmInitiator ? trade.initiatorOutboundShippedAt : trade.targetOutboundShippedAt;
  const myReceived        = iAmInitiator ? trade.initiatorReceivedAt        : trade.targetReceivedAt;
  if (!myOutboundShipped || myReceived) return null;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-6">
      {open ? (
        <div className="flex flex-col gap-2">
          <p className="text-navy font-semibold text-sm mb-1">Report a problem with this trade</p>
          <p className="text-slate-500 text-xs mb-2">
            Use this only if something is wrong with what you received — wrong card, damaged condition, missing item.
            Card Cloud admin will follow up with both parties.
          </p>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Describe what's wrong…" rows={4}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setOpen(false); setReason(""); }} className="text-slate-500 text-xs font-semibold px-3 py-2">Cancel</button>
            <button onClick={() => { if (reason.trim()) onAction("dispute", { reason: reason.trim() }); }}
              disabled={busy || !reason.trim()}
              className="bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
              Submit dispute
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="text-red-600 text-sm font-medium hover:underline">
          🚩 Something wrong with what you received? Report a problem
        </button>
      )}
    </div>
  );
}

function ShipmentSection({ trade, otherName, iAmInitiator, onAction, busy }: {
  trade: Trade; myId: string; otherName: string;
  iAmInitiator: boolean;
  onAction: (path: string, body?: object) => void;
  busy: boolean;
}) {
  const myInbound        = iAmInitiator ? trade.initiatorInboundTracking   : trade.targetInboundTracking;
  const myInboundReceived= iAmInitiator ? trade.initiatorInboundReceivedAt : trade.targetInboundReceivedAt;
  const theirInbound     = iAmInitiator ? trade.targetInboundTracking      : trade.initiatorInboundTracking;
  const theirInboundReceived = iAmInitiator ? trade.targetInboundReceivedAt : trade.initiatorInboundReceivedAt;
  const myOutbound       = iAmInitiator ? trade.initiatorOutboundTracking  : trade.targetOutboundTracking;
  const myOutboundShipped= iAmInitiator ? trade.initiatorOutboundShippedAt : trade.targetOutboundShippedAt;
  const myReceived       = iAmInitiator ? trade.initiatorReceivedAt        : trade.targetReceivedAt;
  const theirReceived    = iAmInitiator ? trade.targetReceivedAt           : trade.initiatorReceivedAt;

  const [tracking, setTracking] = useState("");
  const fmt = (d: Date | string | null) => d ? new Date(d).toLocaleDateString() : null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6 flex flex-col gap-4">
      <div>
        <h2 className="text-blue-900 font-semibold mb-1">Trade accepted — Card Cloud escrow</h2>
        <p className="text-blue-800 text-sm">
          Both sides ship to Card Cloud. Once both packages arrive, Card Cloud forwards each card to the other party.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Inbound: my shipment to Card Cloud */}
        <div className="bg-white rounded-xl p-4 border border-blue-100">
          <p className="text-navy font-semibold text-sm mb-2">Step 1 · Your shipment to Card Cloud</p>
          <a href={`/trades/${trade.id}/packing-slip`} target="_blank"
            className="inline-block text-purple-600 text-xs font-semibold hover:underline mb-3">
            🖨 Open printable packing slip →
          </a>
          {myInboundReceived ? (
            <p className="text-green-700 text-sm font-medium">✓ Card Cloud received {fmt(myInboundReceived)}</p>
          ) : myInbound ? (
            <div className="text-sm">
              <p className="text-slate-500 mb-1">Tracking: <span className="font-mono text-navy">{myInbound}</span></p>
              <p className="text-slate-400 text-xs">Waiting for Card Cloud to receive.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking number after you ship"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button onClick={() => { if (tracking.trim()) onAction("inbound-tracking", { tracking: tracking.trim() }); }} disabled={busy || !tracking.trim()}
                className="self-start bg-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                Save tracking
              </button>
            </div>
          )}
        </div>

        {/* Inbound: their shipment to Card Cloud */}
        <div className="bg-white rounded-xl p-4 border border-blue-100">
          <p className="text-navy font-semibold text-sm mb-2">Step 1 · {otherName}&apos;s shipment to Card Cloud</p>
          {theirInboundReceived ? (
            <p className="text-green-700 text-sm font-medium">✓ Card Cloud received {fmt(theirInboundReceived)}</p>
          ) : theirInbound ? (
            <p className="text-sm text-slate-500">Tracking: <span className="font-mono text-navy">{theirInbound}</span></p>
          ) : (
            <p className="text-slate-400 text-sm italic">Waiting for {otherName} to ship.</p>
          )}
        </div>

        {/* Outbound: Card Cloud → me */}
        <div className="bg-white rounded-xl p-4 border border-blue-100">
          <p className="text-navy font-semibold text-sm mb-2">Step 2 · Card Cloud ships {otherName}&apos;s cards to you</p>
          {myReceived ? (
            <p className="text-green-700 text-sm font-medium">✓ You confirmed receipt {fmt(myReceived)}</p>
          ) : myOutboundShipped ? (
            <div className="text-sm">
              <p className="text-slate-500 mb-1">Tracking: <span className="font-mono text-navy">{myOutbound}</span> · Shipped {fmt(myOutboundShipped)}</p>
              <button onClick={() => { if (confirm("Confirm you received the cards in good condition?")) onAction("confirm-received"); }} disabled={busy}
                className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 mt-1">
                Confirm received
              </button>
            </div>
          ) : (
            <p className="text-slate-400 text-sm italic">Waiting for Card Cloud to ship out.</p>
          )}
        </div>

        {/* Outbound: Card Cloud → them */}
        <div className="bg-white rounded-xl p-4 border border-blue-100">
          <p className="text-navy font-semibold text-sm mb-2">Step 2 · Card Cloud ships your cards to {otherName}</p>
          {theirReceived ? (
            <p className="text-green-700 text-sm font-medium">✓ {otherName} confirmed receipt {fmt(theirReceived)}</p>
          ) : (
            <p className="text-slate-400 text-sm italic">Waiting on the other side.</p>
          )}
        </div>
      </div>
    </div>
  );
}
