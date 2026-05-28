import { db } from "@/lib/db";
import { isOllamaRunning, listModels, getRunningModels } from "@/lib/ollama";
import Link from "next/link";

export default async function AiLabOverviewPage() {
  const [totalExamples, verifiedExamples, pendingReview, ollamaUp] = await Promise.all([
    db.trainingExample.count(),
    db.trainingExample.count({ where: { verified: true } }),
    db.trainingExample.count({ where: { verified: false } }),
    isOllamaRunning(),
  ]);

  const [models, running] = await Promise.all([
    ollamaUp ? listModels().catch(() => []) : Promise.resolve([]),
    ollamaUp ? getRunningModels().catch(() => []) : Promise.resolve([]),
  ]);

  const bySource = await db.trainingExample.groupBy({ by: ["source"], _count: true });

  const stats = [
    { label: "Training examples", value: totalExamples,    sub: "total collected",    href: "/admin/training" },
    { label: "Verified",          value: verifiedExamples, sub: "human-reviewed",     href: "/admin/training" },
    { label: "Pending review",    value: pendingReview,    sub: "awaiting approval",  href: "/admin/training", alert: pendingReview > 0 },
    { label: "Ollama models",     value: models.length,    sub: ollamaUp ? "✓ online" : "✗ offline", href: "/admin/ai-lab/models", alert: !ollamaUp },
  ];

  return (
    <div className="p-8 bg-slate-900 min-h-full">
      <h1 className="text-2xl font-bold text-white mb-1">AI Lab</h1>
      <p className="text-slate-400 text-sm mb-8">Card recognition training pipeline · Local Ollama models</p>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-500 transition-colors">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.alert ? "text-amber-400" : "text-white"}`}>{s.value.toLocaleString()}</p>
            <p className="text-slate-500 text-xs mt-1">{s.sub}</p>
          </Link>
        ))}
      </div>

      {/* Photo Fix shortcut */}
      <Link href="/admin/ai-lab/photo-fix"
        className="flex items-center gap-5 bg-gradient-to-r from-brand/20 to-brand/5 border border-brand/30 rounded-xl p-5 mb-6 hover:from-brand/30 hover:to-brand/10 transition-all">
        <div className="w-12 h-12 bg-brand/20 rounded-xl flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold">Card Photo Straightener</p>
          <p className="text-slate-400 text-sm">Upload phone photos of cards — AI detects edges, corrects rotation, and crops with a clean border.</p>
        </div>
        <span className="text-brand text-sm font-semibold shrink-0">Open →</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data by source */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-white font-semibold mb-4">Training data by source</h2>
          {bySource.length === 0 ? (
            <p className="text-slate-500 text-sm">No training data yet. Run an agent to collect some.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {bySource.map(s => (
                <div key={s.source} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                  <span className="text-slate-300 text-sm capitalize">{s.source.replace(/_/g, " ")}</span>
                  <span className="text-white font-semibold">{s._count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ollama status */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-white font-semibold">Ollama</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${ollamaUp ? "bg-green-900/50 text-green-400 border-green-800" : "bg-red-900/50 text-red-400 border-red-800"}`}>
              {ollamaUp ? "● online" : "○ offline"}
            </span>
          </div>
          {!ollamaUp ? (
            <p className="text-slate-500 text-sm">Start Ollama to use local vision models for card recognition.</p>
          ) : running.length === 0 && models.length > 0 ? (
            <p className="text-slate-500 text-sm">{models.length} model{models.length !== 1 ? "s" : ""} installed, none loaded. Visit <Link href="/admin/ai-lab/models" className="text-brand hover:underline">Models</Link> to load one.</p>
          ) : running.length === 0 ? (
            <p className="text-slate-500 text-sm">No models installed. Visit <Link href="/admin/ai-lab/models" className="text-brand hover:underline">Models</Link> to pull one.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(running as { name: string; size_vram: number }[]).map(m => (
                <div key={m.name} className="flex items-center justify-between py-1">
                  <span className="text-slate-300 text-sm font-mono">{m.name}</span>
                  <span className="text-slate-400 text-xs bg-slate-700 px-2 py-0.5 rounded">
                    {(m.size_vram / 1e9).toFixed(1)} GB VRAM
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
