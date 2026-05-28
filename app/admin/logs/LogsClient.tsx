"use client";

import { useState, useEffect, useCallback } from "react";

type LogLevel    = "info" | "warn" | "error";
type LogCategory = "system" | "user" | "activity" | "ebay" | "auth" | "admin";

interface LogEntry {
  id: string; level: LogLevel; category: LogCategory;
  action: string; message: string; data: unknown;
  userId: string | null; targetId: string | null; targetType: string | null;
  createdAt: string;
}

const LEVEL_STYLE: Record<string, string> = {
  info:  "bg-blue-100 text-blue-700",
  warn:  "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
};
const CAT_STYLE: Record<string, string> = {
  system:   "bg-slate-100 text-slate-600",
  user:     "bg-purple-100 text-purple-700",
  activity: "bg-green-100 text-green-700",
  ebay:     "bg-yellow-100 text-yellow-700",
  auth:     "bg-indigo-100 text-indigo-700",
  admin:    "bg-orange-100 text-orange-700",
};

const CATEGORIES = ["all","system","user","activity","ebay","auth","admin"] as const;
const LEVELS     = ["all","info","warn","error"] as const;

export function LogsClient() {
  const [logs,     setLogs]     = useState<LogEntry[]>([]);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [category, setCategory] = useState<string>("all");
  const [level,    setLevel]    = useState<string>("all");
  const [search,   setSearch]   = useState("");
  const [query,    setQuery]    = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (category !== "all") params.set("category", category);
    if (level    !== "all") params.set("level",    level);
    if (query)              params.set("q",         query);
    const r = await fetch(`/api/admin/logs?${params}`);
    const d = await r.json();
    setLogs(d.logs ?? []);
    setTotal(d.total ?? 0);
    setPages(d.pages ?? 1);
    setLoading(false);
  }, [page, category, level, query]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(fetchLogs, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, fetchLogs]);

  function relTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000)    return `${Math.floor(diff/1000)}s ago`;
    if (diff < 3_600_000) return `${Math.floor(diff/60_000)}m ago`;
    if (diff < 86_400_000)return `${Math.floor(diff/3_600_000)}h ago`;
    return new Date(iso).toLocaleDateString();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-wrap gap-3 items-end">

        {/* Category tabs */}
        <div>
          <p className="text-slate-400 text-xs mb-1.5">Category</p>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => { setCategory(c); setPage(1); }}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${category === c ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Level filter */}
        <div>
          <p className="text-slate-400 text-xs mb-1.5">Level</p>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {LEVELS.map(l => (
              <button key={l} onClick={() => { setLevel(l); setPage(1); }}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${level === l ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-48">
          <p className="text-slate-400 text-xs mb-1.5">Search</p>
          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { setQuery(search); setPage(1); } }}
              placeholder="Search messages or actions…"
              className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <button onClick={() => { setQuery(search); setPage(1); }}
              className="px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-xl hover:bg-blue-600">
              Search
            </button>
          </div>
        </div>

        {/* Auto-refresh + total */}
        <div className="flex items-center gap-3 ml-auto">
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setAutoRefresh(v => !v)}
              className={`w-8 rounded-full relative transition-colors ${autoRefresh ? "bg-green-500" : "bg-slate-200"}`} style={{ height: "18px" }}>
              <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${autoRefresh ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-xs text-slate-500">Live (5s)</span>
          </label>
          <button onClick={fetchLogs} className="text-xs text-brand hover:underline">↻ Refresh</button>
          <span className="text-xs text-slate-400">{total.toLocaleString()} entries</span>
        </div>
      </div>

      {/* Log table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-400 text-sm">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-400 text-sm">No log entries match your filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-2.5 text-slate-400 text-xs font-semibold uppercase tracking-wide w-24">Time</th>
                <th className="text-left px-2 py-2.5 text-slate-400 text-xs font-semibold uppercase tracking-wide w-16">Level</th>
                <th className="text-left px-2 py-2.5 text-slate-400 text-xs font-semibold uppercase tracking-wide w-20">Category</th>
                <th className="text-left px-2 py-2.5 text-slate-400 text-xs font-semibold uppercase tracking-wide w-40">Action</th>
                <th className="text-left px-2 py-2.5 text-slate-400 text-xs font-semibold uppercase tracking-wide">Message</th>
                <th className="text-left px-4 py-2.5 text-slate-400 text-xs font-semibold uppercase tracking-wide w-8"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <>
                  <tr key={log.id}
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                    className={`border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${log.level === "error" ? "bg-red-50/40" : log.level === "warn" ? "bg-amber-50/30" : ""}`}>
                    <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">{relTime(log.createdAt)}</td>
                    <td className="px-2 py-2.5">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${LEVEL_STYLE[log.level] ?? ""}`}>{log.level}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${CAT_STYLE[log.category] ?? ""}`}>{log.category}</span>
                    </td>
                    <td className="px-2 py-2.5 text-slate-500 text-xs font-mono truncate max-w-xs">{log.action}</td>
                    <td className="px-2 py-2.5 text-navy text-sm">{log.message}</td>
                    <td className="px-4 py-2.5 text-slate-300 text-xs">{log.data || log.userId || log.targetId ? "▼" : ""}</td>
                  </tr>
                  {expanded === log.id && (
                    <tr key={`${log.id}-exp`} className="bg-slate-50 border-b border-slate-100">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs mb-2">
                          {log.userId     && <p><span className="text-slate-400">User ID: </span><span className="font-mono text-navy">{log.userId}</span></p>}
                          {log.targetId   && <p><span className="text-slate-400">{log.targetType ?? "Target"} ID: </span><span className="font-mono text-navy">{log.targetId}</span></p>}
                          <p><span className="text-slate-400">Timestamp: </span><span className="text-navy">{new Date(log.createdAt).toLocaleString()}</span></p>
                        </div>
                        {log.data != null && (
                          <pre className="text-xs bg-white border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto text-slate-700">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 disabled:opacity-40">
            ← Previous
          </button>
          <span className="text-slate-400 text-sm">Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 disabled:opacity-40">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
