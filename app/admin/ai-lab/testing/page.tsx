"use client";

import { useState } from "react";

export default function AdminTestingPage() {
  const [image,   setImage]   = useState<string | null>(null);
  const [model,   setModel]   = useState("llama3.2-vision:11b");
  const [mode,    setMode]    = useState<"slab" | "raw">("slab");
  const [result,  setResult]  = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ms,      setMs]      = useState<number | null>(null);

  async function runTest() {
    if (!image) return;
    setLoading(true); setResult(null); setMs(null);
    const start = Date.now();
    try {
      const res = await fetch("/api/ai-lab/ollama/infer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, image, mode }),
      });
      const d = await res.json();
      setResult(typeof d.response === "string" ? d.response : JSON.stringify(d, null, 2));
      setMs(Date.now() - start);
    } catch (e) { setResult(`Error: ${e}`); }
    setLoading(false);
  }

  return (
    <div className="p-8 bg-slate-900 min-h-full">
      <h1 className="text-2xl font-bold text-white mb-1">Model Testing</h1>
      <p className="text-slate-400 text-sm mb-8">Test local Ollama vision models on card images</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h2 className="text-white font-semibold mb-4">Input</h2>

            <div className="flex gap-1 bg-slate-900 p-1 rounded-lg mb-4">
              {(["slab","raw"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${mode === m ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>
                  {m === "slab" ? "Graded slab" : "Raw card"}
                </button>
              ))}
            </div>

            <label className="text-slate-400 text-xs mb-1 block">Model</label>
            <input value={model} onChange={e => setModel(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 font-mono mb-4 focus:outline-none focus:ring-2 focus:ring-brand/40" />

            <label className="block cursor-pointer">
              <div className={`border-2 border-dashed rounded-xl flex items-center justify-center h-48 transition-colors ${image ? "border-slate-600 bg-slate-700" : "border-slate-600 hover:border-brand"}`}>
                {image
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={image} alt="Card" className="max-w-full max-h-full object-contain rounded-xl" />
                  : <div className="text-center"><p className="text-slate-400 text-sm">Click to upload card photo</p><p className="text-slate-600 text-xs mt-1">JPG, PNG, WEBP</p></div>
                }
              </div>
              <input type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = ev => setImage(ev.target?.result as string);
                  reader.readAsDataURL(f);
                }} />
            </label>

            <button onClick={runTest} disabled={!image || loading}
              className="w-full mt-4 bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm">
              {loading ? "Running…" : `Test with ${mode === "slab" ? "slab" : "raw card"} prompt`}
            </button>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Output</h2>
            {ms && <span className="text-slate-500 text-xs">{(ms / 1000).toFixed(1)}s</span>}
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              Running inference…
            </div>
          ) : result ? (
            <pre className="text-slate-300 text-sm font-mono whitespace-pre-wrap leading-relaxed">{result}</pre>
          ) : (
            <p className="text-slate-600 text-sm">Upload an image and click Test to see the model output here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
