import { isOllamaRunning, listModels, getRunningModels } from "@/lib/ollama";
import { AdminModelsClient } from "./AdminModelsClient";

export default async function AdminModelsPage() {
  const ollamaUp = await isOllamaRunning();
  const [models, running] = ollamaUp
    ? await Promise.all([listModels().catch(() => []), getRunningModels().catch(() => [])])
    : [[], []];

  return (
    <div className="p-8 bg-slate-900 min-h-full">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold text-white">Ollama Models</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${ollamaUp ? "bg-green-900/50 text-green-400 border-green-800" : "bg-red-900/50 text-red-400 border-red-800"}`}>
          {ollamaUp ? "● online" : "○ offline"}
        </span>
      </div>
      <p className="text-slate-400 text-sm mb-8">Manage local vision and language models via Ollama</p>

      {!ollamaUp ? (
        <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 text-center">
          <p className="text-slate-300 font-semibold mb-2">Ollama is not running</p>
          <p className="text-slate-500 text-sm">Start Ollama via Pinokio or run <code className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">ollama serve</code> in a terminal.</p>
        </div>
      ) : (
        <AdminModelsClient models={models} running={running} />
      )}
    </div>
  );
}
