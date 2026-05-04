import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CollectionsGrid } from "@/components/collections/CollectionsGrid";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [collections, cardCount] = await Promise.all([
    db.collection.findMany({
      where:   { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { cards: true } },
        cards: {
          orderBy: { addedAt: "desc" },
          take: 12,                           // enough for the cover picker
          include: { card: { select: { photos: true, player: true } } },
        },
      },
    }),
    db.card.count({ where: { ownerId: session.user.id } }),
  ]);

  const totalCollections = collections.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Portfolio stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Collections",     value: totalCollections.toString() },
          { label: "Total cards",     value: cardCount.toString() },
          { label: "Est. value",      value: "$—" },
          { label: "30-day change",   value: "—" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl px-5 py-4 border border-slate-100">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{stat.label}</p>
            <p className="text-navy text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick action tiles */}
      <div className="flex gap-3 mb-8 overflow-x-auto pb-1">
        {[
          { label: "Add card",   icon: PlusIcon,     href: "/dashboard/cards/new",    primary: true  },
          { label: "Scan slab",  icon: ScanIcon,     href: "#",                       primary: false },
          { label: "Bulk import",icon: UploadIcon,   href: "#",                       primary: false },
          { label: "Consign",    icon: TagIcon,      href: "#",                       primary: false },
          { label: "Trade",      icon: TradeIcon,    href: "/dashboard/trade",        primary: false },
        ].map(({ label, icon: Icon, href, primary }) => (
          <Link
            key={label}
            href={href}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
              primary
                ? "bg-amber text-amber-dark hover:brightness-105"
                : "bg-white border border-slate-200 text-navy hover:bg-slate-50"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </div>

      {/* Collections grid */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-navy text-xl font-bold">My Collections</h1>
      </div>

      <CollectionsGrid collections={collections} />
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function ScanIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>;
}
function UploadIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}
function TagIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}
function TradeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>;
}
