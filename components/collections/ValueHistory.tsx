"use client";

import { useState, useMemo } from "react";

export interface Snapshot {
  id: string;
  totalValue: number;
  cardCount: number;
  capturedAt: string; // ISO string
}

interface Props {
  collectionId: string;
  snapshots: Snapshot[];
  accountCreatedAt: string; // ISO string — lower bound for custom picker
}

interface RangeDef {
  label: string;
  days: number | null; // null = All time
}

const PRESET_RANGES: RangeDef[] = [
  { label: "7d",  days: 7   },
  { label: "30d", days: 30  },
  { label: "90d", days: 90  },
  { label: "1y",  days: 365 },
  { label: "All", days: null },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  });
}

function accountAgeDays(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function toInputDate(iso: string) {
  // "2026-04-30T..." → "2026-04-30"
  return iso.split("T")[0];
}

function todayInputDate() {
  return new Date().toISOString().split("T")[0];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ValueHistory({ snapshots, accountCreatedAt }: Props) {
  const ageDays = useMemo(() => accountAgeDays(accountCreatedAt), [accountCreatedAt]);

  // Preset tabs filtered by account age + always show All
  const availablePresets = useMemo(
    () => PRESET_RANGES.filter(r => r.days === null || ageDays >= r.days),
    [ageDays]
  );

  const defaultLabel = useMemo(() => {
    const nonAll = availablePresets.filter(r => r.days !== null);
    return nonAll.length > 0 ? nonAll[nonAll.length - 1].label : "All";
  }, [availablePresets]);

  const [activeLabel,  setActiveLabel]  = useState(defaultLabel);
  const [customFrom,   setCustomFrom]   = useState(toInputDate(accountCreatedAt));
  const [customTo,     setCustomTo]     = useState(todayInputDate());

  const isCustom = activeLabel === "Custom";

  // ── Filter snapshots ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (isCustom) {
      const from = customFrom ? new Date(customFrom + "T00:00:00") : new Date(0);
      const to   = customTo   ? new Date(customTo   + "T23:59:59") : new Date();
      return snapshots.filter(s => {
        const d = new Date(s.capturedAt);
        return d >= from && d <= to;
      });
    }
    const preset = PRESET_RANGES.find(r => r.label === activeLabel);
    if (!preset?.days) return snapshots;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - preset.days);
    return snapshots.filter(s => new Date(s.capturedAt) >= cutoff);
  }, [snapshots, activeLabel, isCustom, customFrom, customTo]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const latest   = filtered[filtered.length - 1] ?? null;
  const earliest = filtered[0] ?? null;
  const current  = latest?.totalValue   ?? 0;
  const start    = earliest?.totalValue ?? 0;
  const change   = current - start;
  const pct      = start > 0 ? (change / start) * 100 : null;
  const positive = change >= 0;

  // ── SVG chart ───────────────────────────────────────────────────────────────
  const W = 600; const H = 120;
  const PAD = { t: 12, r: 8, b: 24, l: 8 };
  const cW  = W - PAD.l - PAD.r;
  const cH  = H - PAD.t - PAD.b;

  const chartData = useMemo(() => {
    if (filtered.length < 2) return null;
    const vals  = filtered.map(s => s.totalValue);
    const times = filtered.map(s => new Date(s.capturedAt).getTime());
    const minV  = Math.min(...vals);  const maxV = Math.max(...vals);
    const minT  = Math.min(...times); const maxT = Math.max(...times);
    const rV    = maxV - minV || 1;   const rT   = maxT - minT || 1;

    const pts = filtered.map(s => ({
      x: PAD.l + ((new Date(s.capturedAt).getTime() - minT) / rT) * cW,
      y: PAD.t + cH - ((s.totalValue - minV) / rV) * cH,
      date: new Date(s.capturedAt).toLocaleDateString(),
    }));

    return {
      pts,
      polyline: pts.map(p => `${p.x},${p.y}`).join(" "),
      area: [
        `${pts[0].x},${PAD.t + cH}`,
        ...pts.map(p => `${p.x},${p.y}`),
        `${pts[pts.length - 1].x},${PAD.t + cH}`,
      ].join(" "),
    };
  }, [filtered]);

  const stroke = positive ? "#3B6D11" : "#A32D2D";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">

      {/* Header + range tabs */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-1">
          Value history
        </p>

        <div className="flex items-center gap-1 flex-wrap justify-end">
          {/* Preset tabs */}
          {availablePresets.map(r => (
            <button
              key={r.label}
              onClick={() => setActiveLabel(r.label)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeLabel === r.label && !isCustom
                  ? "bg-navy text-white"
                  : "text-slate-400 hover:text-navy"
              }`}
            >
              {r.label}
            </button>
          ))}

          {/* Custom tab */}
          <button
            onClick={() => setActiveLabel("Custom")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
              isCustom
                ? "bg-brand text-white"
                : "text-slate-400 hover:text-brand border border-slate-200"
            }`}
          >
            <CalendarIcon className="w-3 h-3" />
            Custom
          </button>
        </div>
      </div>

      {/* Custom date range picker */}
      {isCustom && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-slate-50 rounded-xl flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <label className="text-xs text-slate-500 font-medium shrink-0">From</label>
            <input
              type="date"
              value={customFrom}
              min={toInputDate(accountCreatedAt)}
              max={customTo || todayInputDate()}
              onChange={e => setCustomFrom(e.target.value)}
              className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-navy focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand bg-white"
            />
          </div>
          <span className="text-slate-300 text-sm shrink-0">→</span>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <label className="text-xs text-slate-500 font-medium shrink-0">To</label>
            <input
              type="date"
              value={customTo}
              min={customFrom || toInputDate(accountCreatedAt)}
              max={todayInputDate()}
              onChange={e => setCustomTo(e.target.value)}
              className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-navy focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand bg-white"
            />
          </div>
        </div>
      )}

      {/* No snapshots */}
      {snapshots.length === 0 && (
        <div className="text-center py-10">
          <p className="text-slate-400 text-sm mb-1">No value history yet.</p>
          <p className="text-slate-300 text-xs">
            Snapshots record automatically when cards are added or removed,
            and will show value changes once eBay tracking is enabled.
          </p>
        </div>
      )}

      {/* Snapshots exist but none in range */}
      {snapshots.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm">No snapshots in this date range.</p>
          {isCustom ? (
            <p className="text-slate-300 text-xs mt-1">Try widening the date range.</p>
          ) : (
            <button onClick={() => setActiveLabel("All")} className="text-brand text-xs mt-1 hover:underline">
              View all history
            </button>
          )}
        </div>
      )}

      {/* Chart + stats */}
      {filtered.length > 0 && (
        <>
          <div className="mb-4">
            {chartData ? (
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}
                aria-label="Collection value over time">
                <polygon points={chartData.area} fill={stroke} opacity="0.08" />
                <polyline points={chartData.polyline} fill="none"
                  stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {(() => {
                  const last = chartData.pts[chartData.pts.length - 1];
                  return <circle cx={last.x} cy={last.y} r="3.5" fill={stroke} />;
                })()}
                {[chartData.pts[0], chartData.pts[chartData.pts.length - 1]].map((p, i) => (
                  <text key={i}
                    x={i === 0 ? PAD.l : W - PAD.r} y={H - 2}
                    textAnchor={i === 0 ? "start" : "end"}
                    fontSize="9" fill="#94a3b8">
                    {p.date}
                  </text>
                ))}
              </svg>
            ) : (
              <div className="h-16 flex items-center justify-center">
                <p className="text-slate-300 text-xs">
                  {isCustom
                    ? "Only one snapshot in this range — select a wider period to see a trend."
                    : "Add more cards to see your value trend over time."}
                </p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Current value</p>
              <p className="text-navy text-lg font-bold">
                {current > 0 ? fmt(current) : "$—"}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">
                Change ({isCustom ? "custom range" : activeLabel})
              </p>
              <p className={`text-lg font-bold ${
                change === 0 ? "text-slate-400" : positive ? "text-success" : "text-alert"
              }`}>
                {change === 0 || filtered.length < 2 ? "—" : `${positive ? "+" : ""}${fmt(change)}`}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">% change</p>
              <p className={`text-lg font-bold ${
                !pct || pct === 0 ? "text-slate-400" : pct > 0 ? "text-success" : "text-alert"
              }`}>
                {!pct || filtered.length < 2 ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="border-t border-slate-100 mt-4 pt-3">
        <p className="text-slate-300 text-xs">
          {snapshots.length === 0
            ? "Snapshots record automatically whenever cards are added or removed."
            : `${snapshots.length} snapshot${snapshots.length === 1 ? "" : "s"} · last ${
                new Date(snapshots[snapshots.length - 1].capturedAt).toLocaleDateString()
              }`}
        </p>
      </div>
    </div>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
