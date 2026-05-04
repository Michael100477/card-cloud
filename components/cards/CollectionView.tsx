"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CardTile } from "./CardTile";
import { cn } from "@/lib/utils";

export interface CardRow {
  id: string;
  player: string;
  year: number;
  manufacturer: string;
  set: string;
  subset: string | null;
  cardNumber: string | null;
  sport: string | null;
  team: string | null;
  grade: string | null;
  gradeCompany: string | null;
  tags: string[];
  photos: string[];
  estimatedValue: number | null;
  status: string;
  createdAt: string;
}

type SortField = "player" | "year" | "manufacturer" | "set" | "grade" | "estimatedValue" | "status" | "createdAt";
type SortDir   = "asc" | "desc";

const SPORT_FILTERS = ["All", "Baseball", "Football", "Basketball", "Hockey", "Soccer", "Pokémon", "Magic", "Other"];
const TYPE_FILTERS  = ["All", "Graded", "Rookie", "Auto", "Jersey", "Numbered"];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TRACKING:       { label: "Tracking",  color: "bg-slate-100 text-slate-600" },
  OFFER_PENDING:  { label: "Offer out", color: "bg-amber-muted text-amber" },
  OFFER_ACCEPTED: { label: "Accepted",  color: "bg-success-muted text-success" },
  CONSIGNED:      { label: "Consigned", color: "bg-brand-muted text-brand" },
  LISTED:         { label: "Listed",    color: "bg-brand-muted text-brand" },
  SOLD:           { label: "Sold",      color: "bg-success-muted text-success" },
  TRADE_LISTED:   { label: "For trade", color: "bg-alert-muted text-alert" },
  IN_TRADE:       { label: "In trade",  color: "bg-alert-muted text-alert" },
};

export function CollectionView({ cards, collectionId }: { cards: CardRow[]; collectionId: string }) {
  const [view,       setView]       = useState<"grid" | "table">("grid");
  const [sportFilter, setSportFilter] = useState("All");
  const [typeFilter,  setTypeFilter]  = useState("All");
  const [sortField,  setSortField]  = useState<SortField>("createdAt");
  const [sortDir,    setSortDir]    = useState<SortDir>("desc");

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (sportFilter !== "All") {
        if (!c.sport || c.sport.toLowerCase() !== sportFilter.toLowerCase()) return false;
      }
      if (typeFilter !== "All") {
        if (typeFilter === "Graded") {
          if (!c.grade) return false;
        } else {
          if (!c.tags.some((t) => t.toLowerCase() === typeFilter.toLowerCase())) return false;
        }
      }
      return true;
    });
  }, [cards, sportFilter, typeFilter]);

  // ── Sorting ────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortField) {
        case "player":         av = a.player;         bv = b.player;         break;
        case "year":           av = a.year;           bv = b.year;           break;
        case "manufacturer":   av = a.manufacturer;   bv = b.manufacturer;   break;
        case "set":            av = `${a.set} ${a.subset ?? ""}`; bv = `${b.set} ${b.subset ?? ""}`; break;
        case "grade":          av = a.grade ?? "";    bv = b.grade ?? "";    break;
        case "estimatedValue": av = a.estimatedValue ?? -1; bv = b.estimatedValue ?? -1; break;
        case "status":         av = a.status;         bv = b.status;         break;
        case "createdAt":      av = a.createdAt;      bv = b.createdAt;      break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-brand ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
      {/* Filter + view toggle bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        {/* Sport pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1">
          {SPORT_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setSportFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                sportFilter === s
                  ? "bg-navy text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Type pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                typeFilter === t
                  ? "bg-brand text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setView("grid")}
            className={cn("p-1.5 rounded-md transition-colors", view === "grid" ? "bg-navy text-white" : "text-slate-400 hover:text-slate-600")}
            aria-label="Grid view"
          >
            <GridIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("table")}
            className={cn("p-1.5 rounded-md transition-colors", view === "table" ? "bg-navy text-white" : "text-slate-400 hover:text-slate-600")}
            aria-label="Table view"
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm mb-4">
            {cards.length === 0
              ? "This collection has no cards yet."
              : "No cards match the current filters."}
          </p>
          {cards.length === 0 && (
            <Link
              href={`/dashboard/cards/new?collection=${collectionId}`}
              className="bg-amber text-amber-dark font-semibold px-5 py-2.5 rounded-xl text-sm hover:brightness-105 transition-all"
            >
              Add your first card
            </Link>
          )}
        </div>
      )}

      {/* Grid view */}
      {view === "grid" && sorted.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {sorted.map((card) => (
            <CardTile key={card.id} card={card} />
          ))}
        </div>
      )}

      {/* Table view */}
      {view === "table" && sorted.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {([
                    ["player",        "Player"],
                    ["year",          "Year"],
                    ["manufacturer",  "Mfr"],
                    ["set",           "Set / Subset"],
                    ["grade",         "Grade"],
                    [null,            "Tags"],
                    ["estimatedValue","Value"],
                    [null,            "30d"],
                    ["status",        "Status"],
                  ] as [SortField | null, string][]).map(([field, label]) => (
                    <th
                      key={label}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap",
                        field && "cursor-pointer hover:text-navy transition-colors select-none"
                      )}
                      onClick={() => field && handleSort(field)}
                    >
                      {label}
                      {field && <SortIcon field={field} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((card, i) => (
                  <tr
                    key={card.id}
                    className={cn(
                      "border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer",
                      i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                    )}
                    onClick={() => window.location.href = `/dashboard/cards/${card.id}`}
                  >
                    <td className="px-4 py-3 font-medium text-navy whitespace-nowrap">{card.player}</td>
                    <td className="px-4 py-3 text-slate-600">{card.year}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{card.manufacturer}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {card.set}{card.subset ? ` · ${card.subset}` : ""}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {card.grade ? (
                        <span className="text-xs font-semibold bg-navy/10 text-navy px-2 py-0.5 rounded-full">
                          {card.gradeCompany} {card.grade}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {card.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-xs bg-brand-muted text-brand px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-navy whitespace-nowrap">
                      {card.estimatedValue ? `$${card.estimatedValue.toLocaleString()}` : <span className="text-slate-300">$—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">—</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_LABELS[card.status]?.color ?? "bg-slate-100 text-slate-600")}>
                        {STATUS_LABELS[card.status]?.label ?? card.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  );
}
function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}
