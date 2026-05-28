"use client";

import { useState } from "react";

const RECOMMENDED = [
  { name: "llama3.2-vision:11b", label: "Llama 3.2 Vision 11B", use: "Raw card + slab recognition", vram: "8 GB" },
  { name: "llava:7b",            label: "LLaVA 7B",              use: "General vision tasks",        vram: "5 GB" },
  { name: "llama3.2:3b",        label: "Llama 3.2 3B",          use: "Fast text tasks",             vram: "2 GB" },
];

export function AdminModelsClient({
  models,
  running,
}: {
  models: { name: string; size: number; details: { parameter_size: string } }[];
  running: { name: string; size_vram: number }[];
}) {
  const [pulling,    setPulling]    = useState<string | null>(null);
  const [pullLog,    setPullLog]    = useState("");
  const [customPull, setCustomPull] = useState("");

  const runningNames   = new Set(running.map(m => m.name));
  const installedNames = new Set(models.map(m => m.name));

  async function pull(name: string) {
    setPulling(name); setPullLog("Starting download…");
    try {
      const res = await fetch("/api/ai-lab/ollama/pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = dec.decode(value).split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const d = JSON.parse(line);
            if (d.total) setPullLog(`${d.status} — ${Math.round((d.completed / d.total) * 100)}%`);
            else setPullLog(d.status ?? "");
          } catch { /* partial */ }
        }
      }
      setPullLog("✓ Done!");
    } catch (e) { setPullLog(`Error: ${e}`); }
    finally { setPulling(null); setTimeout(() => setPullLog(""), 3000); }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="text-white font-semibold">Installed models ({models.length})</h2>
        </div>
        {models.length === 0 ? (
          <p className="px-5 py-6 text-slate-500 text-sm">No models installed. Pull one below.</p>
        ) : (
          <div className="divide-y divide-slate-700">
            {models.map(m => (
              <div key={m.name} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-mono">{m.name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {(m.size / 1e9).toFixed(1)} GB · {m.details?.parameter_size ?? ""}
                    {runningNames.has(m.name) && <span className="ml-2 text-green-400">● loaded</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pullLog && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl px-5 py-3 text-sm text-slate-300 font-mono">
          {pulling && <span className="text-amber-400 mr-2">{pulling}</span>}{pullLog}
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div className="px-5 py-4 border-b border-slate-700">
          <h2 className="text-white font-semibold">Recommended for card recognition</h2>
        </div>
        <div className="divide-y divide-slate-700">
          {RECOMMENDED.map(r => (
            <div key={r.name} className="px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-white text-sm font-semibold">{r.label}</p>
                <p className="text-slate-400 text-xs mt-0.5">{r.use} · {r.vram} VRAM</p>
                <p className="text-slate-600 text-xs font-mono mt-0.5">{r.name}</p>
              </div>
              <button onClick={() => pull(r.name)} disabled={installedNames.has(r.name) || pulling !== null}
                className="px-4 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed bg-brand text-white hover:bg-blue-600 shrink-0">
                {installedNames.has(r.name) ? "Installed" : pulling === r.name ? "Pulling…" : "Pull"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-white font-semibold mb-3">Pull a specific model</h2>
        <div className="flex gap-2">
          <input value={customPull} onChange={e => setCustomPull(e.target.value)}
            onKeyDown={e => e.key === "Enter" && customPull && pull(customPull)}
            placeholder="e.g. llava:13b"
            className="flex-1 bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-4 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-brand/40 placeholder-slate-500" />
          <button onClick={() => customPull && pull(customPull)} disabled={!customPull || pulling !== null}
            className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50">
            Pull
          </button>
        </div>
      </div>
    </div>
  );
}
