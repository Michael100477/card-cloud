"use client";

import { useState, useTransition, useMemo } from "react";
import { recordSnapshotAction } from "@/lib/actions/snapshots";

export interface Snapshot {
  id: string;
  totalValue: number;
  cardCount: number;
  capturedAt: string; // ISO string
}

interface Props {
  collectionId: string;
  snapshots: Snapshot[];
}

type Range = "7d" | "30d" | "90d" | "1y" | "all";

const RANGES: { label: string; value: Range; days: number | null }[] = [
  { label: "7d",  value: "7d",  days: 7   },
  { label: "30d", value: "30d", days: 30  },
  { label: "90d", value: "90d", days: 90  },
  { label: "1y",  value: "1y",  days: 365 },
  { label: "All", value: "all", days: null },
];

function fmt(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ValueHistory({ collectionId, snapshots }: Props) {
  const [range, setRange]             = useState<Range>("30d");
  const [isPending, startTransition]  = useTransition();
  const [recordMsg, setRecordMsg]     = useState("");

  // ── Filter to selected range ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const selected = RANGES.find(r => r.value === range)!;
    if (!selected.days) return snapshots;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - selected.days);
    return snapshots.filter(s => new Date(s.capturedAt) >= cutoff);
  }, [snapshots, range]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const latest   = filtered[filtered.length - 1] ?? null;
  const earliest = filtered[0] ?? null;
  const current  = latest?.totalValue ?? 0;
  const start    = earliest?.totalValue ?? 0;
  const change   = current - start;
  const pct      = start > 0 ? (change / start) * 100 : null;

  function doRecord() {
    setRecordMsg("");
    startTransition(async () => {
      const res = await recordSnapshotAction(collectionId);
      if (res.success) {
        setRecordMsg(`Snapshot recorded — ${fmt(res.totalValue)} across ${res.cardCount} cards.`);
      }
    });
  }

  // ── SVG chart ──────────────────────────────────────────────────────────────
  const W = 600; const H = 120; const PAD = { t: 12, r: 8, b: 24, l: 8 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const chartData = useMemo(() => {
    if (filtered.length < 2) return null;
    const values = filtered.map(s => s.totalValue);
    const times  = filtered.map(s => new Date(s.capturedAt).getTime());
    const minV = Math.min(...values); const maxV = Math.max(...values);
    const minT = Math.min(...times);  const maxT = Math.max(...times);
    const rangeV = maxV - minV || 1;  const rangeT = maxT - minT || 1;

    const points = filtered.map(s => ({
      x: PAD.l + ((new Date(s.capturedAt).getTime() - minT) / rangeT) * chartW,
      y: PAD.t + chartH - ((s.totalValue - minV) / rangeV) * chartH,
      value: s.totalValue,
      date: new Date(s.capturedAt).toLocaleDateString(),
    }));

    const polyline = points.map(p => `${p.x},${p.y}`).join(" ");
    const area = [
      `${points[0].x},${PAD.t + chartH}`,
      ...points.map(p => `${p.x},${p.y}`),
      `${points[points.length - 1].x},${PAD.t + chartH}`,
    ].join(" ");

    return { points, polyline, area, minV, maxV };
  }, [filtered]);

  const positive = change >= 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Value history
        </p>

        {/* Range tabs */}
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                range === r.value
                  ? "bg-navy text-white"
                  : "text-slate-400 hover:text-navy"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* No data state */}
      {snapshots.length === 0 && (
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm mb-1">No value history yet.</p>
          <p className="text-slate-300 text-xs">
            Record your first snapshot to start tracking collection value over time.
          </p>
        </div>
      )}

      {/* Not enough data for selected range */}
      {snapshots.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm">No snapshots in the selected range.</p>
          <button onClick={() => setRange("all")} className="text-brand text-xs mt-1 hover:underline">
            View all history
          </button>
        </div>
      )}

      {/* Chart + stats */}
      {filtered.length > 0 && (
        <>
          {/* SVG chart */}
          <div className="mb-4">
            {chartData ? (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full"
                style={{ height: 120 }}
                aria-label="Collection value over time"
              >
                {/* Area fill */}
                <polygon
                  points={chartData.area}
                  fill={positive ? "#3B6D11" : "#A32D2D"}
                  opacity="0.08"
                />
                {/* Line */}
                <polyline
                  points={chartData.polyline}
                  fill="none"
                  stroke={positive ? "#3B6D11" : "#A32D2D"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* End dot */}
                {chartData.points.length > 0 && (() => {
                  const last = chartData.points[chartData.points.length - 1];
                  return (
                    <circle
                      cx={last.x} cy={last.y} r="3.5"
                      fill={positive ? "#3B6D11" : "#A32D2D"}
                    />
                  );
                })()}
                {/* X-axis date labels */}
                {[chartData.points[0], chartData.points[chartData.points.length - 1]].map((p, i) => (
                  <text
                    key={i}
                    x={i === 0 ? PAD.l : W - PAD.r}
                    y={H - 2}
                    textAnchor={i === 0 ? "start" : "end"}
                    fontSize="9"
                    fill="#94a3b8"
                  >
                    {p.date}
                  </text>
                ))}
              </svg>
            ) : (
              /* Single snapshot — just show a dot */
              <div className="h-16 flex items-center justify-center">
                <p className="text-slate-300 text-xs">Record another snapshot to see a chart.</p>
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
                Change{filtered.length > 1 ? ` (${RANGES.find(r => r.value === range)?.label ?? ""})` : ""}
              </p>
              <p className={`text-lg font-bold ${change === 0 ? "text-slate-400" : positive ? "text-success" : "text-alert"}`}>
                {change === 0 || filtered.length < 2
                  ? "—"
                  : `${positive ? "+" : ""}${fmt(change)}`}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">% change</p>
              <p className={`text-lg font-bold ${!pct || pct === 0 ? "text-slate-400" : pct > 0 ? "text-success" : "text-alert"}`}>
                {!pct || filtered.length < 2
                  ? "—"
                  : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Record snapshot */}
      <div className="border-t border-slate-100 mt-4 pt-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-slate-400 text-xs">
          {snapshots.length > 0
            ? `${snapshots.length} snapshot${snapshots.length === 1 ? "" : "s"} recorded · last ${new Date(snapshots[snapshots.length - 1].capturedAt).toLocaleDateString()}`
            : "Snapshots are recorded automatically once live values are enabled."}
        </p>
        <button
          onClick={doRecord}
          disabled={isPending}
          className="text-xs font-semibold text-brand border border-brand/30 px-3 py-1.5 rounded-lg hover:bg-brand-muted transition-colors disabled:opacity-50 shrink-0"
        >
          {isPending ? "Recording…" : "Record snapshot now"}
        </button>
      </div>

      {recordMsg && (
        <p className="text-success text-xs mt-2">{recordMsg}</p>
      )}
    </div>
  );
}
