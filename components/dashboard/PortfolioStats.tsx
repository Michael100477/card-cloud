"use client";

import { useState, useMemo } from "react";

interface Props {
  collectionCount: number;
  cardCount: number;
  accountCreatedAt: string; // ISO
}

function ageDays(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function toInputDate(iso: string) {
  return iso.split("T")[0];
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

export function PortfolioStats({ collectionCount, cardCount, accountCreatedAt }: Props) {
  const age = useMemo(() => ageDays(accountCreatedAt), [accountCreatedAt]);

  // Change tile only appears once account is ≥ 7 days old
  const showChange = age >= 7;

  // Default range label based on age
  const defaultRangeLabel = age >= 30 ? "30d" : "7d";

  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [customFrom,   setCustomFrom]   = useState(toInputDate(accountCreatedAt));
  const [customTo,     setCustomTo]     = useState(todayDate());
  const [activeRange,  setActiveRange]  = useState(defaultRangeLabel);

  const isCustom = activeRange === "Custom";

  // Available preset ranges based on account age (same logic as ValueHistory)
  const presets = useMemo(() => {
    const opts: string[] = [];
    if (age >= 7)   opts.push("7d");
    if (age >= 30)  opts.push("30d");
    if (age >= 90)  opts.push("90d");
    if (age >= 365) opts.push("1y");
    opts.push("All");
    return opts;
  }, [age]);

  function selectPreset(label: string) {
    setActiveRange(label);
    setPickerOpen(false);
  }

  function selectCustom() {
    setActiveRange("Custom");
    setPickerOpen(true);
  }

  const changeLabel = isCustom
    ? `${customFrom} → ${customTo}`
    : `${activeRange} change`;

  return (
    <div className="mb-8">
      <div className={`grid gap-4 ${showChange ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>

        {/* Collections */}
        <StatTile label="Collections" value={collectionCount.toString()} />

        {/* Total cards */}
        <StatTile label="Total cards" value={cardCount.toString()} />

        {/* Est. value */}
        <StatTile label="Est. value" value="$—" />

        {/* Change — only shown once account is ≥ 7 days old */}
        {showChange && (
          <div className="relative">
            <button
              onClick={() => setPickerOpen(p => !p)}
              className="w-full text-left bg-white rounded-2xl px-5 py-4 border border-slate-100 hover:border-slate-200 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">
                  {isCustom ? "Custom change" : `${activeRange} change`}
                </p>
                <CalendarIcon className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand transition-colors" />
              </div>
              <p className="text-navy text-2xl font-bold mt-1">—</p>
            </button>

            {/* Dropdown picker */}
            {pickerOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 p-3">
                {/* Preset range pills */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {presets.map(p => (
                    <button
                      key={p}
                      onClick={() => selectPreset(p)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        activeRange === p && !isCustom
                          ? "bg-navy text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={selectCustom}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      isCustom
                        ? "bg-brand text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {/* Custom date inputs */}
                {isCustom && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 w-8 shrink-0">From</label>
                      <input
                        type="date"
                        value={customFrom}
                        min={toInputDate(accountCreatedAt)}
                        max={customTo || todayDate()}
                        onChange={e => setCustomFrom(e.target.value)}
                        className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-navy focus:outline-none focus:ring-2 focus:ring-brand/40"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 w-8 shrink-0">To</label>
                      <input
                        type="date"
                        value={customTo}
                        min={customFrom || toInputDate(accountCreatedAt)}
                        max={todayDate()}
                        onChange={e => setCustomTo(e.target.value)}
                        className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-navy focus:outline-none focus:ring-2 focus:ring-brand/40"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setPickerOpen(false)}
                  className="mt-2 w-full text-xs text-slate-400 hover:text-slate-600 transition-colors text-right"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hint for very new accounts */}
      {!showChange && (
        <p className="text-slate-300 text-xs mt-2">
          Value change tracking starts after 7 days — {7 - age} day{7 - age === 1 ? "" : "s"} to go.
        </p>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl px-5 py-4 border border-slate-100">
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-navy text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
