import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CardActions } from "@/components/cards/CardActions";
import { CardPhotoDisplay } from "@/components/cards/CardPhotoDisplay";
import { ShareButtons } from "@/components/social/ShareButtons";
import { CommentSection } from "@/components/social/CommentSection";
import { WatchButton } from "@/components/social/WatchButton";
import { FollowButton } from "@/components/social/FollowButton";
import { ShareToFeedButton } from "@/components/cards/ShareToFeedButton";
import { CardVisibilityToggle } from "@/components/cards/CardVisibilityToggle";
import { TradeToggleButton } from "@/components/cards/TradeToggleButton";
import { getLinksMap } from "@/lib/links";

interface Props {
  params: Promise<{ id: string }>;
}

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

  const [card, links] = await Promise.all([
    db.card.findUnique({
    where: { id },
    include: {
      collections: {
        include: { collection: { select: { id: true, name: true } } },
        take: 1,
      },
      _count: { select: { watchers: true } },
      watchers: { where: { userId: session.user.id }, select: { userId: true } },
      owner: {
        select: {
          id: true, displayName: true, username: true,
          _count: { select: { followers: true } },
          followers: { where: { followerId: session.user.id }, select: { followerId: true } },
        },
      },
    },
    }),
    getLinksMap(),
  ]);

  if (!card) notFound();

  const isOwner = card.ownerId === session.user.id;
  if (!card.isPublic && !isOwner) notFound();

  // Check if this card has been shared to the owner's feed
  const feedPost = isOwner
    ? await db.feedPost.findFirst({ where: { userId: session.user.id, cardId: id }, select: { id: true, caption: true } })
    : null;

  const isWatching      = card.watchers.length > 0;
  const watchCount      = card._count.watchers;
  const ownerName       = card.owner.displayName ?? card.owner.username ?? "collector";
  const isFollowingOwner = card.owner.followers.length > 0;
  const ownerFollowerCount = card.owner._count.followers;

  const primaryCollection = card.collections[0]?.collection ?? null;
  const gradient = SPORT_GRADIENT[card.sport ?? ""] ?? ["#185FA5", "#042C53"];
  const gradeBg  = GRADE_BG[card.gradeCompany ?? ""] ?? "#475569";
  const acquiredPrice = card.acquiredPrice ? Number(card.acquiredPrice) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/dashboard" className="hover:text-navy transition-colors">Home</Link>
        <span>/</span>
        <Link href="/dashboard/my-collections" className="hover:text-navy transition-colors">My Collections</Link>
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

          {/* Owner-only actions */}
          {isOwner && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/cards/${id}/edit`}
                  className="flex-1 flex items-center justify-center border border-slate-200 text-navy text-sm font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Edit card
                </Link>
                <CardActions cardId={id} collectionId={primaryCollection?.id ?? null} />
              </div>
              <ShareToFeedButton
                cardId={id}
                initialPostId={feedPost?.id ?? null}
                initialCaption={feedPost?.caption ?? null}
              />
            </div>
          )}
        </div>

        {/* ── Right: details ── */}
        <div className="flex flex-col gap-5">

          {/* Card header */}
          <div>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-navy text-2xl sm:text-3xl font-bold leading-tight">{card.player}</h1>
                <p className="text-slate-500 text-base mt-1">
                  {card.year} · {card.manufacturer} · {card.set}
                  {card.subset ? ` · ${card.subset}` : ""}
                </p>
                {/* Owner attribution + follow button when viewing someone else's card */}
                {!isOwner && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-slate-400 text-sm">by {ownerName}</span>
                    <FollowButton
                      type="user"
                      targetId={card.owner.id}
                      targetName={ownerName}
                      initialFollowing={isFollowingOwner}
                      initialCount={ownerFollowerCount}
                      compact
                    />
                  </div>
                )}
              </div>
              {/* Share + Watch */}
              <div className="flex flex-wrap items-center gap-2">
                <WatchButton
                  cardId={id}
                  initialWatching={isWatching}
                  initialCount={watchCount}
                  estimatedValue={card.estimatedValue ? Number(card.estimatedValue) : null}
                />
                <ShareButtons
                  title={`${card.player} — ${card.year} ${card.manufacturer} ${card.set}${card.grade ? ` ${card.gradeCompany} ${card.grade}` : ""}`}
                  description={`Check out this card on Card Cloud`}
                  isPublic={card.isPublic}
                />
              </div>
            </div>

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
              {card.tags.map(tag => (
                <span key={tag} className="bg-brand-muted text-brand text-xs font-medium px-2.5 py-1 rounded-full">
                  {tag}
                </span>
              ))}
              {isOwner && (
                <CardVisibilityToggle cardId={id} initialIsPublic={card.isPublic} />
              )}
            </div>
          </div>

          {/* Value card */}
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

          {/* Action buttons — owner only */}
          {isOwner && (
            <div className="grid grid-cols-2 gap-3">
              {links["service_offer_cta"]?.enabled !== false && (
                <button className="flex flex-col items-center gap-1.5 bg-amber text-amber-dark font-semibold py-3 rounded-xl text-xs hover:brightness-105 transition-all">
                  <DollarIcon className="w-4 h-4" />
                  Get offer
                </button>
              )}
              <Link
                href={`/exchange/sell?cardId=${id}`}
                className="flex flex-col items-center gap-1.5 bg-green-500 text-white font-semibold py-3 rounded-xl text-xs hover:bg-green-600 transition-colors text-center"
              >
                <DollarIcon className="w-4 h-4" />
                Sell
              </Link>
              <Link
                href={`/dashboard/consign?cardId=${id}`}
                className="flex flex-col items-center gap-1.5 border-2 border-brand text-brand font-semibold py-3 rounded-xl text-xs hover:bg-brand-muted transition-colors text-center"
              >
                <TagIcon className="w-4 h-4" />
                Consign
              </Link>
              <TradeToggleButton cardId={card.id} initial={card.isTradeable} />
            </div>
          )}

          {/* Card details */}
          <DetailSection title="Card details">
            <DetailRow label="Sport"       value={card.sport} />
            <DetailRow label="Team"        value={card.team} />
            <DetailRow label="Card number" value={card.cardNumber} />
            <DetailRow label="Serial"      value={card.serialNumber} />
            <DetailRow label="Cert number" value={card.certNumber} />
          </DetailSection>

          {/* BGS subgrades */}
          {(card.gradeCompany === "BGS" || card.gradeCompany === "BGGS") &&
           (card.bgsSubCentering || card.bgsSubCorners || card.bgsSubEdges || card.bgsSubSurface) && (
            <DetailSection title="BGS Subgrades">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Centering", card.bgsSubCentering],
                  ["Corners",   card.bgsSubCorners],
                  ["Edges",     card.bgsSubEdges],
                  ["Surface",   card.bgsSubSurface],
                ].map(([label, val]) => val != null && (
                  <div key={String(label)} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-slate-400 text-xs">{String(label)}</span>
                    <span className="text-navy text-sm font-bold">{String(Number(val))}</span>
                  </div>
                ))}
              </div>
            </DetailSection>
          )}

          {/* Acquisition — owner only */}
          {isOwner && (card.acquiredDate || acquiredPrice || card.acquiredSource) && (
            <DetailSection title="Acquisition">
              <DetailRow label="Date"   value={card.acquiredDate ? new Date(card.acquiredDate).toLocaleDateString() : null} />
              <DetailRow label="Paid"   value={acquiredPrice ? `$${acquiredPrice.toLocaleString()}` : null} />
              <DetailRow label="Source" value={card.acquiredSource} />
            </DetailSection>
          )}

          {/* Notes — owner only */}
          {isOwner && (card.notes || card.conditionNotes) && (
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

      {/* Comments — full width below the two-column layout */}
      <div className="mt-8">
        <CommentSection
          cardId={id}
          currentUserId={session.user.id}
          isOwner={isOwner}
        />
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

function DollarIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function TagIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}
function TradeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>;
}
