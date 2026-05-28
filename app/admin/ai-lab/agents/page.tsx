"use client";

import { useState } from "react";

type AgentOption =
  | { key: string; label: string; type: "select"; options: string[]; default: string }
  | { key: string; label: string; type: "text" | "number"; default: string };

interface Agent {
  id: string; name: string; description: string; script: string;
  comingSoon?: boolean;
  options: AgentOption[];
}

const AGENTS: Agent[] = [
  {
    id: "ebay-collector", name: "eBay Training Data Collector",
    description: "Searches eBay for graded card listings and downloads slab photos with metadata parsed from the listing title.",
    script: "collect-training-data.py",
    options: [
      { key: "grader", label: "Grader", type: "select", options: ["PSA","BGS","SGC","CGC","BCCG"], default: "PSA" },
      { key: "count",  label: "Count",  type: "number", default: "100" },
    ],
  },
  {
    id: "tcdb-scraper", name: "TCDB Set Scraper",
    description: "Downloads card images and metadata from tcdb.com for a specific set.",
    script: "tcdb-scraper.py",
    options: [
      { key: "search",  label: "Set name",   type: "text",   default: "2024 Topps Chrome Baseball" },
      { key: "year",    label: "Year",        type: "number", default: String(new Date().getFullYear()) },
      { key: "limit",   label: "Card limit",  type: "number", default: "100" },
      { key: "dry-run", label: "Dry run",     type: "select", options: ["false","true"], default: "false" },
    ],
  },
  {
    id: "set-monitor", name: "New Set Monitor",
    description: "Scans Cardboard Connection and Beckett News for newly announced sets.",
    script: "monitor-new-sets.py", options: [],
  },
  {
    id: "tcdb-availability", name: "TCDB Availability Checker",
    description: "Checks TCDB daily for each queued set. Once 70%+ of cards have images, marks it ready to scrape.",
    script: "tcdb-check-availability.py", options: [],
  },
  {
    id: "email-poller", name: "Email Inbox Poller",
    description: "Checks your IMAP inbox for new support emails, processes them with the AI agent, and replies automatically.",
    script: "email-poller-trigger.py", options: [],
  },
  {
    id: "raw-card-recognizer", name: "Raw Card Recognition Agent",
    description: "Uses a local Ollama vision model to identify raw (ungraded) cards from photos.",
    script: "raw-card-agent.py",
    options: [
      { key: "input-dir", label: "Image folder", type: "text",   default: "C:\\Users\\mikea\\card-photos" },
      { key: "model",     label: "Ollama model", type: "text",   default: "llama3.2-vision:11b" },
      { key: "count",     label: "Count",        type: "number", default: "50" },
    ],
  },
];

const CRON_PRESETS = [
  { label: "Every hour",    value: "0 * * * *"   },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily 6am",     value: "0 6 * * *"   },
  { label: "Daily 9am",     value: "0 9 * * *"   },
  { label: "Weekly Monday", value: "0 9 * * 1"   },
  { label: "Custom…",       value: "custom"      },
];

export default function AdminAgentsPage() {
  const [states, setStates] = useState<Record<string, { running: boolean; log: string[]; options: Record<string, string> }>>(
    Object.fromEntries(AGENTS.map(a => [a.id, {
      running: false, log: [],
      options: Object.fromEntries(a.options.map(o => [o.key, o.default])),
    }]))
  );
  const [schedules, setSchedules] = useState<Record<string, { cron: string; enabled: boolean; showScheduler: boolean; saving: boolean }>>({});

  async function saveSchedule(agentId: string, script: string, options: Record<string, string>) {
    setSchedules(p => ({ ...p, [agentId]: { ...p[agentId], saving: true } }));
    await fetch("/api/ai-lab/agents/schedule", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, script, cron: schedules[agentId]?.cron ?? "", enabled: schedules[agentId]?.enabled ?? false, options }),
    });
    setSchedules(p => ({ ...p, [agentId]: { ...p[agentId], saving: false, showScheduler: false } }));
  }

  async function runAgent(agentId: string) {
    const agent = AGENTS.find(a => a.id === agentId)!;
    const state = states[agentId];
    setStates(s => ({ ...s, [agentId]: { ...s[agentId], running: true, log: ["Starting…"] } }));
    try {
      const res = await fetch("/api/ai-lab/agents/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: agent.script, options: state.options }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = dec.decode(value).split("\n").filter(Boolean);
        setStates(s => ({ ...s, [agentId]: { ...s[agentId], log: [...s[agentId].log, ...lines] } }));
      }
    } catch (e) {
      setStates(s => ({ ...s, [agentId]: { ...s[agentId], log: [...s[agentId].log, `Error: ${e}`] } }));
    } finally {
      setStates(s => ({ ...s, [agentId]: { ...s[agentId], running: false } }));
    }
  }

  return (
    <div className="p-8 bg-slate-900 min-h-full">
      <h1 className="text-2xl font-bold text-white mb-1">Agents</h1>
      <p className="text-slate-400 text-sm mb-8">Automated data collection and processing scripts</p>

      <div className="flex flex-col gap-6">
        {AGENTS.map(agent => {
          const state = states[agent.id];
          return (
            <div key={agent.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-5 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-white font-semibold">{agent.name}</h2>
                    {state.running && <span className="text-xs bg-green-900/50 text-green-400 border border-green-800 px-2 py-0.5 rounded-full animate-pulse">● running</span>}
                  </div>
                  <p className="text-slate-400 text-sm">{agent.description}</p>
                  <p className="text-slate-600 text-xs mt-1 font-mono">scripts/{agent.script}</p>
                </div>
                <button onClick={() => runAgent(agent.id)} disabled={state.running}
                  className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-40 shrink-0">
                  {state.running ? "Running…" : "Run"}
                </button>
              </div>

              {agent.options.length > 0 && (
                <div className="px-5 pb-4 flex gap-4 flex-wrap border-t border-slate-700 pt-4">
                  {agent.options.map(opt => (
                    <div key={opt.key}>
                      <label className="block text-slate-400 text-xs mb-1">{opt.label}</label>
                      {opt.type === "select" ? (
                        <select value={state.options[opt.key]}
                          onChange={e => setStates(s => ({ ...s, [agent.id]: { ...s[agent.id], options: { ...s[agent.id].options, [opt.key]: e.target.value } } }))}
                          className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5">
                          {opt.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : opt.type === "text" ? (
                        <input type="text" value={state.options[opt.key]}
                          onChange={e => setStates(s => ({ ...s, [agent.id]: { ...s[agent.id], options: { ...s[agent.id].options, [opt.key]: e.target.value } } }))}
                          className="w-64 bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 font-mono" />
                      ) : (
                        <input type="number" value={state.options[opt.key]}
                          onChange={e => setStates(s => ({ ...s, [agent.id]: { ...s[agent.id], options: { ...s[agent.id].options, [opt.key]: e.target.value } } }))}
                          className="w-28 bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-700">
                {!schedules[agent.id]?.showScheduler ? (
                  <button onClick={() => setSchedules(s => ({ ...s, [agent.id]: { ...{ cron: "0 9 * * *", enabled: false, showScheduler: false, saving: false }, ...s[agent.id], showScheduler: true } }))}
                    className="w-full px-5 py-2.5 text-xs text-slate-500 hover:text-slate-300 text-left">
                    {schedules[agent.id]?.enabled ? `⏰ Scheduled: ${schedules[agent.id].cron} — click to edit` : "＋ Add schedule"}
                  </button>
                ) : (
                  <div className="px-5 py-4 flex flex-wrap gap-3 items-end">
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Preset</label>
                      <select value={CRON_PRESETS.some(p => p.value === schedules[agent.id]?.cron) ? schedules[agent.id].cron : "custom"}
                        onChange={e => { if (e.target.value !== "custom") setSchedules(s => ({ ...s, [agent.id]: { ...s[agent.id], cron: e.target.value } })); }}
                        className="bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5">
                        {CRON_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Cron expression</label>
                      <input value={schedules[agent.id]?.cron ?? ""} onChange={e => setSchedules(s => ({ ...s, [agent.id]: { ...s[agent.id], cron: e.target.value } }))}
                        placeholder="0 9 * * *" className="w-36 bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 font-mono" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={schedules[agent.id]?.enabled ?? false}
                        onChange={e => setSchedules(s => ({ ...s, [agent.id]: { ...s[agent.id], enabled: e.target.checked } }))} className="rounded" />
                      <span className="text-slate-300 text-xs">Enabled</span>
                    </label>
                    <button onClick={() => saveSchedule(agent.id, agent.script, state.options)} disabled={schedules[agent.id]?.saving}
                      className="px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50">
                      {schedules[agent.id]?.saving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setSchedules(s => ({ ...s, [agent.id]: { ...s[agent.id], showScheduler: false } }))}
                      className="text-slate-500 text-xs hover:text-slate-300">Cancel</button>
                  </div>
                )}
              </div>

              {state.log.length > 0 && (
                <div className="border-t border-slate-700 bg-slate-900 p-4 max-h-48 overflow-y-auto">
                  <pre className="text-slate-300 text-xs font-mono whitespace-pre-wrap">{state.log.join("\n")}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
