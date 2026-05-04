import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CardActions } from "@/components/cards/CardActions";
import { CardPhotoDisplay } from "@/components/cards/CardPhotoDisplay";

interface Props {
  params: Promise<{ id: string }>;
}

// Sport → gradient colours for the photo placeholder
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

export default async function CardDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const card = await db.card.findUnique({
    where: { id },
    include: {
      collections: {
        include: { collection: { select: { id: true, name: true } } },
        take: 1,
      },
    },
  });

  if (!card || card.ownerId !== session.user.id) notFound();

  const primaryCollection = card.collections[0]?.collection ?? null;
  const gradient = SPORT_GRADIENT[card.sport ?? ""] ?? ["#185FA5", "#042C53"];
  const gradeBg  = GRADE_BG[card.gradeCompany ?? ""] ?? "#475569";

  const acquiredPrice = card.acquiredPrice ? Number(card.acquiredPrice) : null;
  const allTags = card.tags;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/dashboard" className="hover:text-navy transition-colors">My Collections</Link>
        {primaryCollection && (
          <>
            <span>/</span>
            <Link href={`/dashboard/collections/${primaryCollection.id}`}
              className="hover:text-navy transition-colors">{primaryCollection.name}</Link>
          </>
        )}
        <span>/</span>
        <span className="text-navy font-medium truncate">
          {card.year} · {card.manufacturer} · {card.set}{card.subset ? ` · ${card.subset}` : ""}
        </span>
      </nav>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8">

        {/* ── Left: photo + actions ── */}
        <div className="flex flex-col gap-4">

          <CardPhotoDisplay
            photos={card.photos}
            player={card.player}
            manufacturer={card.manufacturer}
            year={card.year}
            set={card.set}
            subset={card.subset}
            grade={card.grade}
            gradeCompany={card.gradeCompany}
            serialNumber={card.serialNumber}
            gradeBg={gradeBg}
            gradient={gradient}
          />

          {/* Edit / Remove / Delete */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/cards/${id}/edit`}
              className="flex-1 text-center border border-slate-200 text-navy text-sm font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Edit card
            </Link>
            <CardActions cardId={id} collectionId={primaryCollection?.id ?? null} />
          </div>
        </div>

        {/* ── Right: details ── */}
        <div className="flex flex-col gap-5">

          {/* Card header */}
          <div>
            <h1 className="text-navy text-2xl sm:text-3xl font-bold leading-tight">{card.player}</h1>
            <p className="text-slate-500 text-base mt-1">
              {card.year} · {card.manufacturer} · {card.set}
              {card.subset ? ` · ${card.subset}` : ""}
            </p>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {card.grade && (
                <span className="text-white text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: gradeBg }}>
                  {card.gradeCompany} {card.grade}
                </span>
              )}
              {card.serialNumber && (
                <span className="bg-navy text-white text-xs font-semibold px-2.5 py-1 rounded-full font-mono">
                  {card.serialNumber}
                </span>
              )}
              {allTags.map(tag => (
                <span key={tag} className="bg-brand-muted text-brand text-xs font-medium px-2.5 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Value card (placeholder) */}
          <div className="bg-navy rounded-2xl p-5">
            <p className="text-sky-highlight text-xs font-semibold uppercase tracking-wider mb-1">
              Estimated value
            </p>
            <p className="text-white text-4xl font-bold">
              {card.estimatedValue ? `$${Number(card.estimatedValue).toLocaleString()}` : "$—"}
            </p>
            <p className="text-sky-highlight/60 text-xs mt-1">
              Live eBay comps · coming in Phase 2
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-3">
            <button className="flex flex-col items-center gap-1.5 bg-amber text-amber-dark font-semibold py-3 rounded-xl text-xs hover:brightness-105 transition-all">
              <DollarIcon className="w-4 h-4" />
              Get offer
            </button>
            <button className="flex flex-col items-center gap-1.5 border-2 border-brand text-brand font-semibold py-3 rounded-xl text-xs hover:bg-brand-muted transition-colors">
              <TagIcon className="w-4 h-4" />
              Consign
            </button>
            <button className="flex flex-col items-center gap-1.5 border-2 border-purple-500 text-purple-600 font-semibold py-3 rounded-xl text-xs hover:bg-purple-50 transition-colors">
              <TradeIcon className="w-4 h-4" />
              Trade
            </button>
          </div>

          {/* Card details */}
          <DetailSection title="Card details">
            <DetailRow label="Sport"       value={card.sport} />
            <DetailRow label="Team"        value={card.team} />
            <DetailRow label="Card number" value={card.cardNumber} />
            <DetailRow label="Serial"      value={card.serialNumber} />
            <DetailRow label="Cert number" value={card.certNumber} />
          </DetailSection>

          {/* Acquisition */}
          {(card.acquiredDate || acquiredPrice || card.acquiredSource) && (
            <DetailSection title="Acquisition">
              <DetailRow label="Date"   value={card.acquiredDate ? new Date(card.acquiredDate).toLocaleDateString() : null} />
              <DetailRow label="Paid"   value={acquiredPrice ? `$${acquiredPrice.toLocaleString()}` : null} />
              <DetailRow label="Source" value={card.acquiredSource} />
            </DetailSection>
          )}

          {/* Notes */}
          {(card.notes || card.conditionNotes) && (
            <DetailSection title="Notes">
              {card.notes && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">General</p>
                  <p className="text-slate-600 text-sm leading-relaxed">{card.notes}</p>
                </div>
              )}
              {card.conditionNotes && (
                <div className={card.notes ? "border-t border-slate-100 pt-3 mt-1" : ""}>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Condition</p>
                  <p className="text-slate-600 text-sm leading-relaxed">{card.conditionNotes}</p>
                </div>
              )}
            </DetailSection>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-400 text-sm shrink-0">{label}</span>
      <span className="text-navy text-sm font-medium text-right">{value}</span>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function DollarIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function TagIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}
function TradeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>;
}
