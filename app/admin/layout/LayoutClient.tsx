"use client";

import { useState } from "react";
import type { WidgetDef } from "@/lib/layout";

interface LayoutRow { id: string; page: string; widgetKey: string; order: number; enabled: boolean }
interface Props {
  pages:          string[];
  initialLayouts: Record<string, LayoutRow[]>;
  registry:       Record<string, WidgetDef>;
}

function pageLabel(p: string): string {
  if (p === "ebay_listing") return "eBay Listing";
  return p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, " ");
}

export function LayoutClient({ pages, initialLayouts, registry }: Props) {
  const [activePage, setActivePage] = useState(pages[0] ?? "dashboard");
  const [layouts, setLayouts] = useState<Record<string, LayoutRow[]>>(initialLayouts);
  const [saving, setSaving] = useState<string | null>(null);

  // eBay listing widgets are always-on — no enable/disable, no add/remove
  const isAlwaysOn = activePage === "ebay_listing";

  const rows = [...(layouts[activePage] ?? [])].sort((a, b) => a.order - b.order);

  // All widgets not already on this page — any widget can be added to any page
  const usedKeys = new Set(rows.map(r => r.widgetKey));
  const available = Object.values(registry).filter(w => !usedKeys.has(w.key));

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function patch(widgetKey: string, data: Partial<LayoutRow>) {
    setSaving(widgetKey);
    await fetch("/api/admin/layout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: activePage, widgetKey, ...data }),
    });
    setSaving(null);
  }

  async function batchReorder(updated: LayoutRow[]) {
    await fetch("/api/admin/layout", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: activePage, widgets: updated.map(r => ({ id: r.id, order: r.order })) }),
    });
  }

  function updateLocal(widgetKey: string, changes: Partial<LayoutRow>) {
    setLayouts(prev => ({
      ...prev,
      [activePage]: (prev[activePage] ?? []).map(r => r.widgetKey === widgetKey ? { ...r, ...changes } : r),
    }));
  }

  // ── Toggle enabled ─────────────────────────────────────────────────────────

  async function toggle(row: LayoutRow) {
    updateLocal(row.widgetKey, { enabled: !row.enabled });
    await patch(row.widgetKey, { enabled: !row.enabled });
  }

  // ── Reorder ────────────────────────────────────────────────────────────────

  function reorderTo(widgetKey: string, newOrder: number) {
    const sorted = [...rows].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(r => r.widgetKey === widgetKey);
    if (idx < 0) return;

    // Remove and reinsert at new position
    const clamped = Math.max(1, Math.min(sorted.length, newOrder));
    const moved   = sorted.splice(idx, 1)[0];
    sorted.splice(clamped - 1, 0, moved);

    // Reassign sequential orders
    const reassigned = sorted.map((r, i) => ({ ...r, order: i + 1 }));
    setLayouts(prev => ({ ...prev, [activePage]: reassigned }));
    batchReorder(reassigned);
  }

  function moveUp(widgetKey: string) {
    const sorted = [...rows];
    const idx = sorted.findIndex(r => r.widgetKey === widgetKey);
    if (idx <= 0) return;
    reorderTo(widgetKey, sorted[idx].order - 1);
  }

  function moveDown(widgetKey: string) {
    const sorted = [...rows];
    const idx = sorted.findIndex(r => r.widgetKey === widgetKey);
    if (idx < 0 || idx >= sorted.length - 1) return;
    reorderTo(widgetKey, sorted[idx].order + 1);
  }

  // ── Add widget ─────────────────────────────────────────────────────────────

  async function addWidget(widgetKey: string) {
    const maxOrder = rows.length > 0 ? Math.max(...rows.map(r => r.order)) : 0;
    const newOrder = maxOrder + 1;
    const r = await fetch("/api/admin/layout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: activePage, widgetKey, order: newOrder, enabled: true }),
    });
    const newRow = await r.json();
    setLayouts(prev => ({ ...prev, [activePage]: [...(prev[activePage] ?? []), newRow] }));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const sorted = [...rows].sort((a, b) => a.order - b.order);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">Page Layout</h1>
      <p className="text-slate-400 text-sm mb-6">
        Control which widgets appear on each page and in what order. Disabled widgets disappear entirely.
      </p>

      {/* Page tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {pages.map(p => (
          <button key={p} onClick={() => setActivePage(p)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activePage === p ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
            {pageLabel(p)}
          </button>
        ))}
      </div>

      {/* Widget list */}
      <div className="flex flex-col gap-2 mb-6">
        {sorted.map((row, idx) => {
          const def = registry[row.widgetKey];
          if (!def) return null;
          const isSaving = saving === row.widgetKey;
          const isFirst  = idx === 0;
          const isLast   = idx === sorted.length - 1;

          return (
            <div key={row.id}
              className={`bg-white rounded-2xl border overflow-hidden transition-all ${row.enabled ? "border-slate-100" : "border-slate-100 opacity-60"}`}>
              <div className="flex items-center gap-3 px-4 py-3.5">
                {/* Position number */}
                <input
                  type="number"
                  value={row.order}
                  min={1}
                  max={sorted.length}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) reorderTo(row.widgetKey, val);
                  }}
                  className="w-10 text-center text-navy text-sm font-bold border border-slate-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />

                {/* Up / Down arrows */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveUp(row.widgetKey)} disabled={isFirst}
                    className="text-slate-300 hover:text-navy disabled:opacity-20 transition-colors leading-none">
                    <ChevronUpIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => moveDown(row.widgetKey)} disabled={isLast}
                    className="text-slate-300 hover:text-navy disabled:opacity-20 transition-colors leading-none">
                    <ChevronDownIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Widget info */}
                <div className="flex-1 min-w-0">
                  <p className="text-navy text-sm font-semibold">{def.label}</p>
                  <p className="text-slate-400 text-xs truncate">{def.description}</p>
                </div>

                {/* Enable toggle — hidden for always-on pages like eBay Listing */}
                {!isAlwaysOn && (
                  <button
                    onClick={() => toggle(row)}
                    disabled={isSaving}
                    title={row.enabled ? "Visible — click to hide" : "Hidden — click to show"}
                    className={`w-9 h-5 rounded-full relative transition-colors shrink-0 disabled:opacity-50 ${row.enabled ? "bg-green-500" : "bg-slate-200"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${row.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Available widgets to add — hidden for always-on pages */}
      {!isAlwaysOn && available.length > 0 && (
        <div>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Add widget</p>
          <div className="flex flex-col gap-2">
            {available.map(w => (
              <div key={w.key}
                className="bg-slate-50 rounded-xl border border-dashed border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-navy text-sm font-medium">{w.label}</p>
                  <p className="text-slate-400 text-xs">{w.description}</p>
                </div>
                <button onClick={() => addWidget(w.key)}
                  className="text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 font-medium shrink-0">
                  + Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>;
}
function ChevronDownIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
}

