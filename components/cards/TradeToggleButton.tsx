"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TradeToggleButton({ cardId, initial }: { cardId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function toggle() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTradeable: !on }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `Failed (${r.status})`);
      setOn(!on);
      router.refresh();
    } catch (e) {
      setErr(String(e));
    }
    setBusy(false);
  }

  return (
    <>
      <button
        onClick={toggle}
        disabled={busy}
        title={on ? "This card is marked as available for trade. Click to remove from trade pool." : "Mark this card as available for trade so other users can propose offers."}
        className={
          on
            ? "flex flex-col items-center gap-1.5 bg-purple-600 text-white font-semibold py-3 rounded-xl text-xs hover:bg-purple-700 transition-colors disabled:opacity-50"
            : "flex flex-col items-center gap-1.5 border-2 border-purple-500 text-purple-600 font-semibold py-3 rounded-xl text-xs hover:bg-purple-50 transition-colors disabled:opacity-50"
        }
      >
        <TradeIcon className="w-4 h-4" />
        {busy ? "Saving…" : on ? "Open to trade ✓" : "Trade"}
      </button>
      {err && <p className="col-span-3 text-red-500 text-xs mt-1">{err}</p>}
    </>
  );
}

function TradeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  );
}
