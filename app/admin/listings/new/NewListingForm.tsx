"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewListingForm({ itemId, orderId, suggestedTitle }: {
  itemId: string; orderId: string; suggestedTitle: string;
}) {
  const router = useRouter();
  const [title,         setTitle]         = useState(suggestedTitle);
  const [description,   setDescription]   = useState("");
  const [startPrice,    setStartPrice]    = useState("");
  const [buyItNowPrice, setBuyItNowPrice] = useState("");
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");

  async function save() {
    if (!title || !startPrice) { setError("Title and start price are required."); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/admin/listings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consignmentItemId: itemId,
          title,
          description,
          startPrice:    parseFloat(startPrice),
          buyItNowPrice: buyItNowPrice ? parseFloat(buyItNowPrice) : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Failed"); setSaving(false); return; }
      router.push(`/admin/consignments/${orderId}`);
    } catch (e) { setError(`Error: ${e}`); setSaving(false); }
  }

  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30 placeholder-slate-400";

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col gap-4">
      <div>
        <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">
          Listing title <span className="text-red-400">*</span>
        </label>
        <input value={title} onChange={e => setTitle(e.target.value)} className={inp} />
        <p className="text-slate-400 text-xs mt-1">{title.length}/80 chars (eBay max)</p>
      </div>

      <div>
        <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          rows={5} placeholder="Card condition, photos included, shipping details…"
          className={inp + " resize-none"} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">
            Start / auction price <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input type="number" step="0.01" value={startPrice} onChange={e => setStartPrice(e.target.value)}
              placeholder="0.99" className={inp + " pl-7"} />
          </div>
        </div>
        <div>
          <label className="text-navy text-xs font-semibold uppercase tracking-wide mb-1.5 block">Buy It Now price</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input type="number" step="0.01" value={buyItNowPrice} onChange={e => setBuyItNowPrice(e.target.value)}
              placeholder="Optional" className={inp + " pl-7"} />
          </div>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button onClick={save} disabled={saving}
          className="flex-1 bg-brand text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50">
          {saving ? "Saving…" : "Save listing"}
        </button>
        <button onClick={() => router.back()} className="px-5 py-3 border border-slate-200 text-slate-500 rounded-xl text-sm hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  );
}
