"use client";

import { useState } from "react";
import { LogsClient }      from "./LogsClient";
import { ChangelogClient } from "./ChangelogClient";

const TABS = [
  { id: "logs",      label: "System Logs",      desc: "All platform events — errors, user actions, eBay activity, admin operations." },
  { id: "changelog", label: "Claude Changelog",  desc: "A running record of everything Claude builds, fixes, and changes." },
] as const;

type Tab = typeof TABS[number]["id"];

export default function AdminLogsPage() {
  const [tab, setTab] = useState<Tab>("logs");
  const active = TABS.find(t => t.id === tab)!;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">Logs</h1>
      <p className="text-slate-400 text-sm mb-5">{active.desc}</p>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-200 p-1 rounded-xl w-fit mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-white text-navy shadow-sm"
                : "text-slate-500 hover:text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "logs"      && <LogsClient />}
      {tab === "changelog" && <ChangelogClient />}
    </div>
  );
}
