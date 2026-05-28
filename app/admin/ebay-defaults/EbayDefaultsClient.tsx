"use client";

import { useState } from "react";
import { FIELD_CONFIGS } from "@/lib/ebay-listing-defaults-shared";
import type { EbayListingDefaults, FieldConfig } from "@/lib/ebay-listing-defaults-shared";

async function saveSetting(key: string, value: string) {
  await fetch("/api/admin/content", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

export function EbayDefaultsClient({ defaults: initial }: { defaults: EbayListingDefaults }) {
  const [d,       setD]       = useState<EbayListingDefaults>(initial);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  function patch(draftField: string, value: string | boolean | number) {
    setD(prev => ({ ...prev, [draftField]: value }));
  }

  async function save() {
    setSaving(true);
    await Promise.all(
      FIELD_CONFIGS.map(f =>
        saveSetting(f.key, String(d[f.draftField] ?? f.defaultValue))
      )
    );
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  // Group configs by section
  const sections = FIELD_CONFIGS.reduce<Record<string, FieldConfig[]>>((acc, f) => {
    (acc[f.section] ??= []).push(f);
    return acc;
  }, {});

  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white";

  function renderField(f: FieldConfig) {
    const val = d[f.draftField] ?? f.defaultValue;

    if (f.type === "toggle") {
      return (
        <div key={f.key} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
          <div className="pr-4">
            <p className="text-sm text-navy">{f.label}</p>
            {f.hint && <p className="text-xs text-slate-400 mt-0.5">{f.hint}</p>}
          </div>
          <div
            onClick={() => patch(f.draftField, !val)}
            className={`w-10 h-6 rounded-full relative transition-colors shrink-0 cursor-pointer ${val ? "bg-brand" : "bg-slate-200"}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${val ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
        </div>
      );
    }

    if (f.type === "select") {
      return (
        <div key={f.key} className="flex flex-col gap-1">
          <label className="text-slate-400 text-xs">{f.label}</label>
          <select value={String(val)} onChange={e => patch(f.draftField, e.target.value)} className={inp}>
            {f.options?.map(o => (
              <option key={String(o)} value={String(o)}>
                {String(o) === "" ? "(auto / blank)" : String(o)}
              </option>
            ))}
          </select>
          {f.hint && <p className="text-xs text-slate-400">{f.hint}</p>}
        </div>
      );
    }

    if (f.type === "number-select") {
      return (
        <div key={f.key} className="flex flex-col gap-1">
          <label className="text-slate-400 text-xs">{f.label}</label>
          <div className="flex gap-2">
            {f.options?.map(o => (
              <button key={o} type="button"
                onClick={() => patch(f.draftField, o as number)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  val === o ? "bg-navy text-white border-navy" : "bg-white text-slate-600 border-slate-200 hover:border-navy"
                }`}>
                {o}{f.draftField === "auctionDuration" ? "d" : ""}
              </button>
            ))}
          </div>
          {f.hint && <p className="text-xs text-slate-400">{f.hint}</p>}
        </div>
      );
    }

    // text / fallback
    return (
      <div key={f.key} className="flex flex-col gap-1">
        <label className="text-slate-400 text-xs">{f.label}</label>
        <input value={String(val)} onChange={e => patch(f.draftField, e.target.value)}
          placeholder={String(f.defaultValue) || "(blank)"} className={inp} />
        {f.hint && <p className="text-xs text-slate-400">{f.hint}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {Object.entries(sections).map(([section, fields]) => {
        const toggles = fields.filter(f => f.type === "toggle");
        const others  = fields.filter(f => f.type !== "toggle");

        return (
          <div key={section} className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{section}</p>

            {/* Non-toggle fields in a 2-column grid */}
            {others.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {others.map(f => (
                  <div key={f.key} className={f.type === "number-select" ? "col-span-2" : ""}>
                    {renderField(f)}
                  </div>
                ))}
              </div>
            )}

            {/* Toggle fields stacked */}
            {toggles.length > 0 && (
              <div className={others.length > 0 ? "border-t border-slate-100 pt-3" : ""}>
                {toggles.map(f => renderField(f))}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3 pb-8">
        <button onClick={save} disabled={saving}
          className="bg-brand text-white font-semibold text-sm px-6 py-2.5 rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : "Save defaults"}
        </button>
        {saved && <span className="text-green-600 text-sm font-medium">✓ Saved</span>}
      </div>
    </div>
  );
}
