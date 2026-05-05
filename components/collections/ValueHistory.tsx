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
  accountCreatedAt: string; // ISO string — used to filter available ranges
}

interface RangeDef {
  label: string;
  days: number | null; // null = "All time since registration"
}

const ALL_RANGES: RangeDef[] = [
  { label: "7d",  days: 7   },
  { label: "30d", days: 30  },
  { label: "90d", days: 90  },
  { label: "1y",  days: 365 },
  { label: "All", days: null },
];

function fmt(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  });
}

function accountAgeDays(accountCreatedAt: string): number {
  return Math.floor(
    (Date.now() - new Date(accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function ValueHistory({ snapshots, accountCreatedAt }: Props) {
  const ageDays = useMemo(() => accountAgeDays(accountCreatedAt), [accountCreatedAt]);

  // Only show ranges the account is old enough to have data for
  const availableRanges = useMemo(() =>
    ALL_RANGES.filter(r => r.days === null || ageDays >= r.days),
    [ageDays]
  );

  // Default to the longest non-"All" range available, or "All" if nothing else
  const defaultRange = useMemo(() => {
    const nonAll = availableRanges.filter(r => r.days !== null);
    return nonAll.length > 0 ? nonAll[nonAll.length - 1].label : "All";
  }, [availableRanges]);

  const [activeLabel, setActiveLabel] = useState(defaultRange);

  // Ensure selected range stays valid if availableRanges changes (shouldn't, but safe)
  const safeLabel = availableRanges.some(r => r.label === activeLabel) ? activeLabel : defaultRange;

  // ── Filter snapshots to selected range ────────────────────────────────────
  const filtered = useMemo(() => {
    const range = ALL_RANGES.find(r => r.label === safeLabel)!;
    if (!range.days) return snapshots;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range.days);
    return snapshots.filter(s => new Date(s.capturedAt) >= cutoff);
  }, [snapshots, safeLabel]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const latest   = filtered[filtered.length - 1] ?? null;
  const earliest = filtered[0] ?? null;
  const current  = latest?.totalValue ?? 0;
  const start    = earliest?.totalValue ?? 0;
  const change   = current - start;
  const pct      = start > 0 ? (change / start) * 100 : null;
  const positive = change >= 0;

  // ── SVG chart ─────────────────────────────────────────────────────────────
  const W = 600; const H = 120;
  const PAD = { t: 12, r: 8, b: 24, l: 8 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const chartData = useMemo(() => {
    if (filtered.length < 2) return null;
    const values = filtered.map(s => s.totalValue);
    const times  = filtered.map(s => new Date(s.capturedAt).getTime());
    const minV = Math.min(...values); const maxV = Math.max(...values);
    const minT = Math.min(...times);  const maxT = Math.max(...times);
    const rangeV = maxV - minV || 1;  const rangeT = maxT - minT || 1;

    const pts = filtered.map(s => ({
      x: PAD.l + ((new Date(s.capturedAt).getTime() - minT) / rangeT) * chartW,
      y: PAD.t + chartH - ((s.totalValue - minV) / rangeV) * chartH,
      value: s.totalValue,
      date: new Date(s.capturedAt).toLocaleDateString(),
    }));

    const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");
    const area = [
      `${pts[0].x},${PAD.t + chartH}`,
      ...pts.map(p => `${p.x},${p.y}`),
      `${pts[pts.length - 1].x},${PAD.t + chartH}`,
    ].join(" ");

    return { pts, polyline, area };
  }, [filtered]);

  const strokeColor = positive ? "#3B6D11" : "#A32D2D";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">

      {/* Header + range tabs */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Value history
        </p>
        <div className="flex gap-1">
          {availableRanges.map(r => (
            <button
              key={r.label}
              onClick={() => setActiveLabel(r.label)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                safeLabel === r.label
                  ? "bg-navy text-white"
                  : "text-slate-400 hover:text-navy"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* No snapshots yet */}
      {snapshots.length === 0 && (
        <div className="text-center py-10">
          <p className="text-slate-400 text-sm mb-1">No value history yet.</p>
          <p className="text-slate-300 text-xs">
            Snapshots are recorded automatically when cards are added or removed,
            and will update with live values once eBay tracking is enabled.
          </p>
        </div>
      )}

      {/* Snapshots exist but none in this range */}
      {snapshots.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm">No snapshots in this date range.</p>
          <button onClick={() => setActiveLabel("All")} className="text-brand text-xs mt-1 hover:underline">
            View all history
          </button>
        </div>
      )}

      {/* Chart + stats */}
      {filtered.length > 0 && (
        <>
          {/* SVG line chart */}
          <div className="mb-4">
            {chartData ? (
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}
                aria-label="Collection value over time">
                <polygon points={chartData.area} fill={strokeColor} opacity="0.08" />
                <polyline points={chartData.polyline} fill="none"
                  stroke={strokeColor} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
                {/* Latest value dot */}
                {(() => {
                  const last = chartData.pts[chartData.pts.length - 1];
                  return <circle cx={last.x} cy={last.y} r="3.5" fill={strokeColor} />;
                })()}
                {/* Start / end date labels */}
                {[chartData.pts[0], chartData.pts[chartData.pts.length - 1]].map((p, i) => (
                  <text key={i}
                    x={i === 0 ? PAD.l : W - PAD.r}
                    y={H - 2}
                    textAnchor={i === 0 ? "start" : "end"}
                    fontSize="9" fill="#94a3b8">
                    {p.date}
                  </text>
                ))}
              </svg>
            ) : (
              <div className="h-16 flex items-center justify-center">
                <p className="text-slate-300 text-xs">
                  Add more cards to see your value trend over time.
                </p>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Current value</p>
              <p className="text-navy text-lg font-bold">
                {current > 0 ? fmt(current) : "$—"}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">
                Change ({safeLabel})
              </p>
              <p className={`text-lg font-bold ${
                change === 0 ? "text-slate-400"
                : positive   ? "text-success"
                             : "text-alert"
              }`}>
                {change === 0 || filtered.length < 2
                  ? "—"
                  : `${positive ? "+" : ""}${fmt(change)}`}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">% change</p>
              <p className={`text-lg font-bold ${
                !pct || pct === 0 ? "text-slate-400"
                : pct > 0        ? "text-success"
                                 : "text-alert"
              }`}>
                {!pct || filtered.length < 2
                  ? "—"
                  : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Footer — snapshot count + account context */}
      <div className="border-t border-slate-100 mt-4 pt-3">
        <p className="text-slate-300 text-xs">
          {snapshots.length === 0
            ? "Snapshots record automatically whenever cards are added or removed."
            : `${snapshots.length} snapshot${snapshots.length === 1 ? "" : "s"} · last recorded ${
                new Date(snapshots[snapshots.length - 1].capturedAt).toLocaleDateString()
              } · tracking since account creation`}
        </p>
      </div>
    </div>
  );
}
