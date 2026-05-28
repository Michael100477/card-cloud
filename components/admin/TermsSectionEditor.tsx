"use client";

import { useState } from "react";
import { TERMS_DEFAULTS } from "@/lib/terms-defaults";

interface TermsSection { id: string; title: string; body: string; show: boolean }

function uid() { return Math.random().toString(36).slice(2, 9); }

async function persist(key: string, items: TermsSection[]) {
  await fetch("/api/admin/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value: JSON.stringify(items) }),
  });
}

export function TermsSectionEditor({ termsKey, initialValue }: { termsKey: string; initialValue: string }) {
  const [items, setItems] = useState<TermsSection[]>(() => {
    try {
      const parsed = JSON.parse(initialValue || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* fall through */ }
    return TERMS_DEFAULTS.map((s, i) => ({ id: String(i), title: s.title, body: s.body, show: true }));
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  async function save(updated: TermsSection[]) {
    setSaving(true);
    await persist(termsKey, updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addItem() {
    const updated = [...items, { id: uid(), title: "", body: "", show: true }];
    setItems(updated);
    save(updated);
  }

  function remove(id: string) {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    save(updated);
  }

  function update(id: string, field: "title" | "body", val: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i));
  }

  async function toggleShow(id: string) {
    const updated = items.map(i => i.id === id ? { ...i, show: !i.show } : i);
    setItems(updated);
    save(updated);
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const b = [...items];
    [b[idx - 1], b[idx]] = [b[idx], b[idx - 1]];
    setItems(b); save(b);
  }

  function moveDown(idx: number) {
    if (idx === items.length - 1) return;
    const b = [...items];
    [b[idx], b[idx + 1]] = [b[idx + 1], b[idx]];
    setItems(b); save(b);
  }

  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30";

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && (
        <p className="text-slate-400 text-xs italic">No sections — click "+ Add section" below.</p>
      )}

      {items.map((item, idx) => (
        <div key={item.id} className={`bg-slate-50 rounded-xl border border-slate-200 p-4 ${!item.show ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">§{idx + 1}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => moveUp(idx)} disabled={idx === 0}
                className="text-slate-300 hover:text-navy disabled:opacity-20 text-sm px-1">↑</button>
              <button onClick={() => moveDown(idx)} disabled={idx === items.length - 1}
                className="text-slate-300 hover:text-navy disabled:opacity-20 text-sm px-1">↓</button>
              <button onClick={() => toggleShow(item.id)}
                className={`w-8 h-5 rounded-full relative transition-colors ${item.show ? "bg-green-500" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.show ? "translate-x-3" : "translate-x-0.5"}`} />
              </button>
              <button onClick={() => remove(item.id)} className="text-slate-300 hover:text-red-500 text-sm transition-colors">×</button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <input
              value={item.title}
              onChange={e => update(item.id, "title", e.target.value)}
              onBlur={() => save(items)}
              placeholder="Section title (e.g. 1. Acceptance of Terms)"
              className={inp}
            />
            <textarea
              value={item.body}
              onChange={e => update(item.id, "body", e.target.value)}
              onBlur={() => save(items)}
              placeholder="Section content…"
              rows={6}
              className={`${inp} resize-y`}
            />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-1">
        <button onClick={addItem}
          className="flex items-center gap-1.5 text-xs bg-brand text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-600">
          + Add section
        </button>
        {saving && <span className="text-xs text-slate-400">Saving…</span>}
        {saved  && <span className="text-xs text-green-600">✓ Saved</span>}
      </div>
    </div>
  );
}
