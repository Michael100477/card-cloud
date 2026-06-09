"use client";

import { useState } from "react";
import Link from "next/link";

interface RateInfo {
  id:              string;
  carrier:         string;
  service:         string;
  rate:            number;
  currency:        string;
  deliveryDays?:   number;
  estDeliveryDays?: number;
  deliveryDate?:   string | null;
}

interface LabelResult {
  labelUrl:       string;
  trackingNumber: string;
  carrier:        string;
  service:        string;
  cost:           number;
}

const SERVICE_LABEL: Record<string, string> = {
  GroundAdvantage:  "USPS Ground Advantage",
  Priority:         "USPS Priority",
  PriorityExpress:  "USPS Priority Express",
  First:            "USPS First-Class",
  ParcelSelect:     "USPS Parcel Select",
};

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function StandaloneLabelClient() {
  const [to, setTo] = useState({
    name: "", street1: "", street2: "", city: "", state: "", zip: "", country: "US", phone: "",
  });
  const [parcel, setParcel] = useState({ length: 11, width: 6, height: 1, weight: 3 });
  const [insuranceValue, setInsuranceValue] = useState<number | "">("");

  // 3 phases: "form" → "quote" → "bought"
  const [phase, setPhase] = useState<"form" | "quote" | "bought">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shipmentId,    setShipmentId]    = useState<string>("");
  const [rates,         setRates]         = useState<RateInfo[]>([]);
  const [selectedRate,  setSelectedRate]  = useState<string>("");
  const [result,        setResult]        = useState<LabelResult | null>(null);

  async function getQuote(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/shipping/standalone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to, parcel,
          insuranceValue: insuranceValue === "" ? undefined : Number(insuranceValue),
        }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? `HTTP ${r.status}`); }
      else {
        setShipmentId(data.shipmentId);
        setRates(data.rates ?? []);
        setSelectedRate(data.rates?.[0]?.id ?? "");   // pre-pick cheapest
        setPhase("quote");
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  async function buyLabel() {
    if (!shipmentId || !selectedRate) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/shipping/standalone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId, rateId: selectedRate }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? `HTTP ${r.status}`); }
      else { setResult(data as LabelResult); setPhase("bought"); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  function reset() {
    setPhase("form");
    setError(null);
    setShipmentId(""); setRates([]); setSelectedRate(""); setResult(null);
    setTo({ name: "", street1: "", street2: "", city: "", state: "", zip: "", country: "US", phone: "" });
    setParcel({ length: 11, width: 6, height: 1, weight: 3 });
    setInsuranceValue("");
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/admin/shipping" className="text-brand text-sm hover:underline">← Shipping</Link>
      </div>
      <h1 className="text-2xl font-bold text-navy mb-1">Create new label</h1>
      <p className="text-slate-400 text-sm mb-6">
        Get a quote first, then buy the rate you want. No charge until you click Buy.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 whitespace-pre-wrap break-words mb-4">
          {error}
        </div>
      )}

      {phase === "bought" && result ? (
        <div className="bg-white rounded-2xl border border-green-200 p-8">
          <p className="text-green-700 font-semibold mb-2">✓ Label purchased</p>
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm mb-6">
            <dt className="text-slate-400">Tracking</dt> <dd className="text-navy font-mono">{result.trackingNumber}</dd>
            <dt className="text-slate-400">Carrier</dt>  <dd className="text-navy">{result.carrier}</dd>
            <dt className="text-slate-400">Service</dt>  <dd className="text-navy">{SERVICE_LABEL[result.service] ?? result.service}</dd>
            <dt className="text-slate-400">Cost</dt>     <dd className="text-navy">{usd(result.cost)}</dd>
          </dl>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={`/print/label?label_url=${encodeURIComponent(result.labelUrl)}&tracking=${encodeURIComponent(result.trackingNumber)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-600">
              Print label →
            </a>
            <a href={result.labelUrl} target="_blank" rel="noopener noreferrer"
              className="text-brand text-sm hover:underline">
              Open raw label
            </a>
            <button onClick={reset} className="text-brand text-sm hover:underline">
              Create another label
            </button>
          </div>
        </div>
      ) : phase === "quote" ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6">
          {/* Summary of the shipment */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-navy font-semibold text-sm">Shipment</h2>
              <button onClick={() => setPhase("form")} className="text-brand text-xs hover:underline">Edit</button>
            </div>
            <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-700">
              <p className="text-navy font-medium">{to.name}</p>
              <p>{to.street1}{to.street2 ? `, ${to.street2}` : ""}</p>
              <p>{to.city}, {to.state} {to.zip} {to.country !== "US" ? `· ${to.country}` : ""}</p>
              <p className="text-slate-400 text-xs mt-2">
                {parcel.length}″ × {parcel.width}″ × {parcel.height}″, {parcel.weight} oz
                {insuranceValue !== "" && ` · insured for ${usd(Number(insuranceValue))}`}
              </p>
            </div>
          </section>

          {/* Rates table */}
          <section>
            <h2 className="text-navy font-semibold text-sm mb-2">Available rates ({rates.length})</h2>
            {rates.length === 0 ? (
              <p className="text-slate-400 text-sm">No USPS rates were returned for this shipment. Check the recipient address.</p>
            ) : (
              <div className="space-y-2">
                {rates.map(r => {
                  const isSelected = r.id === selectedRate;
                  return (
                    <label key={r.id}
                      className={`block px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                        isSelected
                          ? "border-brand bg-brand/5"
                          : "border-slate-100 bg-white hover:border-slate-200"
                      }`}>
                      <div className="flex items-center gap-3">
                        <input type="radio" name="rate" value={r.id} checked={isSelected}
                          onChange={() => setSelectedRate(r.id)}
                          className="accent-brand" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-navy font-medium text-sm">
                              {SERVICE_LABEL[r.service] ?? r.service}
                            </p>
                            <p className="text-navy font-bold text-lg">{usd(r.rate)}</p>
                          </div>
                          {(r.deliveryDays != null || r.estDeliveryDays != null) && (
                            <p className="text-slate-400 text-xs mt-0.5">
                              {r.deliveryDays != null
                                ? `Estimated ${r.deliveryDays} day${r.deliveryDays === 1 ? "" : "s"}`
                                : r.estDeliveryDays != null
                                  ? `~${r.estDeliveryDays} days`
                                  : ""}
                              {r.deliveryDate ? ` · arrives ${new Date(r.deliveryDate).toLocaleDateString()}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setPhase("form")} className="text-slate-500 text-sm hover:text-slate-700">Back</button>
            <button onClick={buyLabel} disabled={busy || !selectedRate}
              className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-600 disabled:opacity-50">
              {busy ? "Buying label…" : `Buy label · ${selectedRate ? usd(rates.find(r => r.id === selectedRate)?.rate ?? 0) : "—"}`}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={getQuote} className="bg-white rounded-2xl border border-slate-100 p-6 space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-navy font-semibold text-sm">Recipient</legend>
            <Field label="Name *"     value={to.name}    onChange={v => setTo({ ...to, name: v })} />
            <div className="grid grid-cols-[2fr_1fr] gap-3">
              <Field label="Street 1 *" value={to.street1} onChange={v => setTo({ ...to, street1: v })} />
              <Field label="Street 2"   value={to.street2} onChange={v => setTo({ ...to, street2: v })} />
            </div>
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
              <Field label="City *"  value={to.city}  onChange={v => setTo({ ...to, city: v })} />
              <Field label="State *" value={to.state} onChange={v => setTo({ ...to, state: v.toUpperCase() })} placeholder="CT" />
              <Field label="ZIP *"   value={to.zip}   onChange={v => setTo({ ...to, zip: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Country" value={to.country} onChange={v => setTo({ ...to, country: v.toUpperCase() })} />
              <Field label="Phone"   value={to.phone}   onChange={v => setTo({ ...to, phone: v })} />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-navy font-semibold text-sm">Package</legend>
            <div className="grid grid-cols-4 gap-3">
              <NumField label="Length (in)" value={parcel.length} onChange={v => setParcel({ ...parcel, length: v })} />
              <NumField label="Width (in)"  value={parcel.width}  onChange={v => setParcel({ ...parcel, width: v })} />
              <NumField label="Height (in)" value={parcel.height} onChange={v => setParcel({ ...parcel, height: v })} />
              <NumField label="Weight (oz)" value={parcel.weight} onChange={v => setParcel({ ...parcel, weight: v })} />
            </div>
            <p className="text-slate-400 text-xs">Defaults to a standard padded envelope for trading cards (11×6×1″, 3 oz).</p>
          </fieldset>

          <fieldset>
            <legend className="text-navy font-semibold text-sm mb-3">Options</legend>
            <div>
              <label className="text-slate-500 text-xs mb-1 block">Insurance value (USD) — optional</label>
              <input type="number" min="0" step="0.01"
                value={insuranceValue} onChange={e => setInsuranceValue(e.target.value === "" ? "" : parseFloat(e.target.value))}
                placeholder="0"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
          </fieldset>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/admin/shipping" className="text-slate-500 text-sm hover:text-slate-700">Cancel</Link>
            <button type="submit" disabled={busy}
              className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-600 disabled:opacity-50">
              {busy ? "Getting rates…" : "Get rates"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-slate-500 text-xs mb-1 block">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-slate-500 text-xs mb-1 block">{label}</label>
      <input type="number" min="0" step="0.1" value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
    </div>
  );
}
