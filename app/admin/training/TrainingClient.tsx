"use client";

import { useState } from "react";

interface TrainingExample {
  id: string; imageKey: string; source: string;
  grader: string | null; certNumber: string | null; player: string | null;
  year: number | null; manufacturer: string | null; set: string | null;
  grade: string | null; verified: boolean; createdAt: Date;
}

export function TrainingClient({ initialPending, verifiedCount, totalCount }: {
  initialPending: TrainingExample[];
  verifiedCount: number;
  totalCount: number;
}) {
  const [pending,  setPending]  = useState<TrainingExample[]>(initialPending);
  const [actioned, setActioned] = useState<Record<string, "approved" | "rejected">>();

  async function approve(id: string) {
    await fetch(`/api/admin/training/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: true }),
    });
    setActioned(a => ({ ...a, [id]: "approved" }));
    setTimeout(() => setPending(p => p.filter(e => e.id !== id)), 600);
  }

  async function reject(id: string) {
    await fetch(`/api/admin/training/${id}`, { method: "DELETE" });
    setActioned(a => ({ ...a, [id]: "rejected" }));
    setTimeout(() => setPending(p => p.filter(e => e.id !== id)), 600);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">Training Data</h1>
      <div className="flex items-center gap-6 mb-8">
        <Stat label="Pending review" value={pending.length} highlight={pending.length > 0} />
        <Stat label="Verified"       value={verifiedCount} />
        <Stat label="Total"          value={totalCount} />
      </div>

      {pending.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-slate-400 text-sm">All training examples have been reviewed.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {pending.map(ex => {
          const action = actioned?.[ex.id];
          return (
            <div
              key={ex.id}
              className={`bg-white rounded-2xl border overflow-hidden transition-all ${
                action === "approved" ? "border-green-300 opacity-50 scale-95"
                : action === "rejected" ? "border-red-300 opacity-50 scale-95"
                : "border-slate-100"
              }`}
            >
              {/* Image placeholder (imageKey is a storage key, not a URL yet) */}
              <div className="aspect-[3/4] bg-slate-100 flex items-center justify-center text-slate-400 text-xs p-3 text-center">
                <div>
                  <p className="font-mono text-xs break-all mb-1">{ex.imageKey.slice(0, 30)}…</p>
                  <p className="text-slate-300 text-xs">Image via {ex.source}</p>
                </div>
              </div>

              {/* Metadata */}
              <div className="p-3 text-xs space-y-0.5">
                {ex.player       && <p><span className="text-slate-400">Player:</span> <span className="text-navy font-medium">{ex.player}</span></p>}
                {ex.year         && <p><span className="text-slate-400">Year:</span> {ex.year}</p>}
                {ex.manufacturer && <p><span className="text-slate-400">Mfr:</span> {ex.manufacturer}</p>}
                {ex.set          && <p><span className="text-slate-400">Set:</span> {ex.set}</p>}
                {ex.grader       && <p><span className="text-slate-400">Grader:</span> {ex.grader} {ex.grade}</p>}
                {ex.certNumber   && <p><span className="text-slate-400">Cert:</span> {ex.certNumber}</p>}
                <p className="text-slate-300">{ex.source} · {new Date(ex.createdAt).toLocaleDateString()}</p>
              </div>

              {/* Actions */}
              <div className="flex border-t border-slate-100">
                <button
                  onClick={() => approve(ex.id)}
                  className="flex-1 py-2 text-xs font-semibold text-green-600 hover:bg-green-50 transition-colors"
                >
                  ✓ Approve
                </button>
                <div className="w-px bg-slate-100" />
                <button
                  onClick={() => reject(ex.id)}
                  className="flex-1 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${highlight ? "text-red-500" : "text-navy"}`}>{value}</p>
      <p className="text-slate-400 text-xs">{label}</p>
    </div>
  );
}
