import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { WatchButton } from "@/components/social/WatchButton";

const SPORT_GRADIENT: Record<string, [string, string]> = {
  Baseball:               ["#CE1141", "#041E42"],
  Football:               ["#8B4513", "#C8A96E"],
  Basketball:             ["#C9430A", "#1D428A"],
  Hockey:                 ["#003087", "#C8102E"],
  Soccer:                 ["#1A6B3C", "#F6EB16"],
  "Pokémon":              ["#FF0000", "#FFCB05"],
  "Magic: The Gathering": ["#1A1A2E", "#6B21A8"],
  "Yu-Gi-Oh!":            ["#2C1654", "#D4AF37"],
  Golf:                   ["#2D6A4F", "#95D5B2"],
};

const GRADE_BG: Record<string, string> = {
  PSA: "#185FA5", BGS: "#1a1a1a", SGC: "#059669", CGC: "#d97706", HGA: "#7c3aed",
};

export default async function WatchlistPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const watches = await db.cardWatch.findMany({
    where:   { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      card: {
        select: {
          id: true, player: true, year: true, manufacturer: true, set: true, subset: true,
          sport: true, grade: true, gradeCompany: true, serialNumber: true, tags: true,
          photos: true, estimatedValue: true, isPublic: true, ownerId: true,
          owner: { select: { displayName: true, username: true } },
        },
      },
    },
  });

  const items = watches.map(w => {
    const card        = w.card;
    const current     = card.estimatedValue ? Number(card.estimatedValue) : null;
    const atWatch     = w.priceAtWatch ? Number(w.priceAtWatch) : null;
    const delta       = current != null && atWatch != null ? current - atWatch : null;
    const deltaPct    = delta != null && atWatch != null && atWatch > 0 ? (delta / atWatch) * 100 : null;
    const gradient    = SPORT_GRADIENT[card.sport ?? ""] ?? ["#185FA5", "#042C53"];
    const isOwner     = card.ownerId === session.user?.id;

    return { watch: w, card, current, atWatch, delta, deltaPct, gradient, isOwner };
  });

  const totalCurrent  = items.reduce((s, i) => s + (i.current ?? 0), 0);
  const totalAtWatch  = items.reduce((s, i) => s + (i.atWatch ?? 0), 0);
  const totalDelta    = totalCurrent - totalAtWatch;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-navy text-2xl font-bold">Watchlist</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {items.length} {items.length === 1 ? "card" : "cards"} — track value changes over time
          </p>
        </div>

        {/* Summary strip */}
        {items.length > 0 && (
          <div className="hidden sm:flex items-center gap-6 bg-white rounded-2xl border border-slate-100 px-5 py-3">
            <Stat label="Total current value" value={totalCurrent > 0 ? `$${totalCurrent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"} />
            {totalAtWatch > 0 && (
              <>
                <div className="w-px h-8 bg-slate-100" />
                <Stat label="Value when added" value={`$${totalAtWatch.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                <div className="w-px h-8 bg-slate-100" />
                <Stat
                  label="Total change"
                  value={formatDelta(totalDelta)}
                  valueClass={deltaColor(totalDelta)}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <EyeIcon className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-navy font-semibold mb-1">Your watchlist is empty</p>
          <p className="text-slate-400 text-sm">
            Hit <strong>Watch</strong> on any card — yours or someone else&apos;s — to track its value here.
          </p>
        </div>
      )}

      {/* Watchlist table */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:grid">
            <span>Card</span>
            <span className="text-right w-28">Value added</span>
            <span className="text-right w-28">Current value</span>
            <span className="text-right w-28">Change</span>
            <span className="w-24" />
          </div>

          {/* Rows */}
          {items.map(({ watch, card, current, atWatch, delta, deltaPct, gradient, isOwner }, idx) => {
            const gradeBg    = GRADE_BG[card.gradeCompany ?? ""] ?? "#475569";
            const ownerLabel = isOwner ? "Your card" : (card.owner.displayName ?? card.owner.username ?? "");

            return (
              <div
                key={watch.cardId}
                className={`grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 ${idx > 0 ? "border-t border-slate-100" : ""} hover:bg-slate-50 transition-colors`}
              >
                {/* Card identity */}
                <Link href={`/dashboard/cards/${card.id}`} className="flex items-center gap-3 min-w-0 group">
                  {/* Thumbnail */}
                  <div
                    className="w-12 h-16 rounded-lg shrink-0 overflow-hidden flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
                  >
                    {card.photos[0]
                      ? <img src={card.photos[0]} alt={card.player} className="w-full h-full object-cover" />
                      : <span className="text-center px-1 leading-tight opacity-80">{card.player.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>
                    }
                  </div>
                  {/* Text */}
                  <div className="min-w-0">
                    <p className="text-navy font-semibold text-sm group-hover:text-brand transition-colors truncate">{card.player}</p>
                    <p className="text-slate-400 text-xs truncate">
                      {card.year} · {card.manufacturer} · {card.set}
                      {card.subset ? ` · ${card.subset}` : ""}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {card.grade && (
                        <span className="text-white text-xs font-bold px-1.5 py-0.5 rounded-md" style={{ background: gradeBg }}>
                          {card.gradeCompany} {card.grade}
                        </span>
                      )}
                      {card.serialNumber && (
                        <span className="text-navy text-xs font-mono bg-navy/10 px-1.5 py-0.5 rounded-md">{card.serialNumber}</span>
                      )}
                      {ownerLabel && (
                        <span className="text-slate-400 text-xs">{ownerLabel}</span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Value at watch */}
                <div className="md:text-right w-full md:w-28">
                  <p className="text-xs text-slate-400 md:hidden mb-0.5">Value when added</p>
                  <p className="text-slate-500 text-sm font-medium">
                    {atWatch != null ? `$${atWatch.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">{formatRelativeDate(watch.createdAt)}</p>
                </div>

                {/* Current value */}
                <div className="md:text-right w-full md:w-28">
                  <p className="text-xs text-slate-400 md:hidden mb-0.5">Current value</p>
                  <p className="text-navy text-sm font-semibold">
                    {current != null ? `$${current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">est.</p>
                </div>

                {/* Change */}
                <div className="md:text-right w-full md:w-28">
                  <p className="text-xs text-slate-400 md:hidden mb-0.5">Change</p>
                  {delta != null ? (
                    <>
                      <p className={`text-sm font-bold ${deltaColor(delta)}`}>{formatDelta(delta)}</p>
                      {deltaPct != null && (
                        <p className={`text-xs mt-0.5 ${deltaColor(delta)}`}>
                          {deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}%
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-300 text-sm">—</p>
                  )}
                </div>

                {/* Unwatch */}
                <div className="w-full md:w-24 flex md:justify-end">
                  <WatchButton
                    cardId={card.id}
                    initialWatching={true}
                    initialCount={0}
                    estimatedValue={current}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDelta(delta: number): string {
  const abs = Math.abs(delta);
  const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${delta >= 0 ? "+" : "-"}$${formatted}`;
}

function deltaColor(delta: number): string {
  if (delta > 0) return "text-green-600";
  if (delta < 0) return "text-red-500";
  return "text-slate-400";
}

function formatRelativeDate(date: Date): string {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-slate-400 text-xs mb-0.5">{label}</p>
      <p className={`text-navy font-bold text-sm ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
