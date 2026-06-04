"use client";

import { useState, useEffect } from "react";

interface ChangelogSection {
  heading: string;
  items: string[];
}

interface ChangelogEntry {
  date: string;
  title: string;
  summary: string;
  sections: ChangelogSection[];
}

const SECTION_COLORS: Record<string, string> = {
  "Features Built":             "bg-green-50  border-green-200  text-green-700",
  "Files Created / Modified":   "bg-blue-50   border-blue-200   text-blue-700",
  "Bugs Fixed":                 "bg-red-50    border-red-200    text-red-700",
  "Schema Changes":             "bg-purple-50 border-purple-200 text-purple-700",
  "Environment Variables Added":"bg-amber-50  border-amber-200  text-amber-700",
  "Third-Party Services Configured":"bg-sky-50 border-sky-200   text-sky-700",
  "Decisions Made":             "bg-indigo-50 border-indigo-200 text-indigo-700",
  "Known Issues / Debt Left":   "bg-orange-50 border-orange-200 text-orange-700",
};

function sectionColor(heading: string) {
  return SECTION_COLORS[heading] ?? "bg-slate-50 border-slate-200 text-slate-600";
}

function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export function ChangelogClient() {
  const [entries,  setEntries]  = useState<ChangelogEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/changelog")
      .then(r => r.json())
      .then(d => {
        setEntries(d.entries ?? []);
        if (d.entries?.length) setExpanded(d.entries[0].date);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-slate-100 px-6 py-10 text-center text-slate-400 text-sm">
      Loading changelog…
    </div>
  );

  if (!entries.length) return (
    <div className="bg-white rounded-2xl border border-slate-100 px-6 py-10 text-center text-slate-400 text-sm">
      No changelog entries yet. Claude will write entries here after each session.
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Legend */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">Legend</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SECTION_COLORS).map(([label, cls]) => {
            const bg = cls.split(" ")[0];
            const border = cls.split(" ")[1];
            const text = cls.split(" ")[2];
            return (
              <span key={label} className={`text-xs px-2 py-0.5 rounded border ${bg} ${border} ${text}`}>
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Entries */}
      {entries.map(entry => {
        const open = expanded === entry.date;
        return (
          <div key={entry.date} className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
            {/* Header */}
            <button
              onClick={() => setExpanded(open ? null : entry.date)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide leading-none mb-0.5">
                    {entry.date.slice(0, 7)}
                  </p>
                  <p className="text-2xl font-bold text-navy leading-none">{entry.date.slice(8)}</p>
                </div>
                <div>
                  <p className="text-navy font-semibold text-sm">{entry.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{formatDate(entry.date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                  {entry.sections.length} section{entry.sections.length !== 1 ? "s" : ""}
                </span>
                <span className="text-slate-300 text-sm">{open ? "▲" : "▼"}</span>
              </div>
            </button>

            {/* Body */}
            {open && (
              <div className="px-6 pb-6 border-t border-slate-100">
                {/* Summary */}
                {entry.summary && (
                  <p className="text-slate-600 text-sm mt-4 mb-5 leading-relaxed bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                    {entry.summary}
                  </p>
                )}

                {/* Sections */}
                <div className="grid gap-4">
                  {entry.sections.map(sec => {
                    const colorCls = sectionColor(sec.heading);
                    const [bg, border, text] = colorCls.split(" ");
                    return (
                      <div key={sec.heading} className={`rounded-xl border ${bg} ${border} p-4`}>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${text}`}>
                          {sec.heading}
                        </p>
                        <ul className="space-y-1.5">
                          {sec.items.map((item, i) => (
                            <li key={i} className="flex gap-2 text-sm text-slate-700">
                              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${text.replace("text-", "bg-")}`} />
                              <span className="font-mono text-xs leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
