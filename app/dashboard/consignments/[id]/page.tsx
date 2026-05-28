import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}

const ITEM_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: "Pending",  cls: "bg-slate-100 text-slate-500"   },
  received: { label: "Received", cls: "bg-blue-100 text-blue-700"     },
  listed:   { label: "Listed",   cls: "bg-purple-100 text-purple-700" },
  sold:     { label: "Sold",     cls: "bg-green-100 text-green-700"   },
  returned: { label: "Returned", cls: "bg-amber-100 text-amber-700"   },
};

export default async function ConsignmentDetailPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const { new: isNew } = await searchParams;

  const order = await db.consignmentOrder.findUnique({
    where:   { id },
    include: { items: { include: { listing: true }, orderBy: { id: "asc" } } },
  });

  if (!order || order.userId !== session.user.id) notFound();

  const orderRef = `CC-${id.slice(-8).toUpperCase()}`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Success banner */}
      {isNew && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6">
          <p className="text-green-800 font-semibold text-base">Consignment submitted!</p>
          <p className="text-green-700 text-sm mt-1 mb-4">
            Print your packing slip below and include it in the box when you ship your cards. We&apos;ll email you once we&apos;ve received them.
          </p>
          <Link
            href={`/print/consignment/${id}`}
            target="_blank"
            className="inline-flex items-center gap-2 bg-green-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-green-800 transition-colors"
          >
            <PrintIcon className="w-4 h-4" />
            Print packing slip
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/dashboard/consignments" className="text-slate-400 text-sm hover:text-navy transition-colors mb-2 block">
            ← My Consignments
          </Link>
          <h1 className="text-navy text-2xl font-bold">Consignment Order</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            <span className="font-mono font-medium text-navy text-sm">{orderRef}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400 text-sm">
              Submitted <span className="text-navy font-medium">{new Date(order.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </span>
            {order.receivedAt && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400 text-sm">
                  Received <span className="text-navy font-medium">{new Date(order.receivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={order.status} />
          <Link
            href={`/print/consignment/${id}`}
            target="_blank"
            className="flex items-center gap-1.5 text-slate-400 hover:text-navy text-xs transition-colors"
          >
            <PrintIcon className="w-3.5 h-3.5" />
            Print packing slip
          </Link>
        </div>
      </div>

      {/* Shipping address — shown while order is pending */}
      {order.status === "pending" && (
        <div className="bg-navy rounded-2xl p-5 mb-6">
          <p className="text-sky-highlight text-xs font-semibold uppercase tracking-widest mb-3">
            Ship your cards to
          </p>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-white font-bold text-lg">The Card Cloud</p>
              <p className="text-sky-highlight text-sm mt-0.5">69 Nagy Rd</p>
              <p className="text-sky-highlight text-sm">Ashford, CT 06278</p>
              <p className="text-sky-highlight/60 text-sm">United States</p>
              <p className="text-sky-highlight/70 text-xs mt-3">
                Include your packing slip in the box so we can identify your shipment immediately.
              </p>
            </div>
            <Link
              href={`/print/consignment/${id}`}
              target="_blank"
              className="shrink-0 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              <PrintIcon className="w-4 h-4" />
              Print slip
            </Link>
          </div>
        </div>
      )}

      {/* Status timeline */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6">
        <h2 className="text-navy font-semibold text-sm mb-4">Order status</h2>
        <Timeline status={order.status} receivedAt={order.receivedAt} submittedAt={order.submittedAt} />
      </div>

      {/* Items */}
      <h2 className="text-navy font-semibold mb-3">{order.items.length} card{order.items.length !== 1 ? "s" : ""}</h2>
      <div className="flex flex-col gap-3">
        {order.items.map(item => {
          const st = ITEM_STATUS[item.status] ?? ITEM_STATUS.pending;
          return (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-navy font-semibold">{item.player}</p>
                  <p className="text-slate-400 text-sm mt-0.5">
                    {[item.year, item.manufacturer, item.set, item.subset].filter(Boolean).join(" · ")}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {item.graded && item.gradeCompany && (
                      <span className="text-xs bg-navy/10 text-navy px-2 py-0.5 rounded-full font-mono">
                        {item.gradeCompany} {item.grade}
                      </span>
                    )}
                    {item.autographed && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Auto</span>}
                    {item.numbered && item.serialNumber && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">{item.serialNumber}</span>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
              </div>

              {item.listing && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-1.5">eBay Listing</p>
                  <p className="text-navy text-sm font-medium">{item.listing.title}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                    <span>Start: ${Number(item.listing.startPrice).toLocaleString()}</span>
                    {item.listing.buyItNowPrice && <span>BIN: ${Number(item.listing.buyItNowPrice).toLocaleString()}</span>}
                    {item.listing.soldPrice && <span className="text-green-600 font-semibold">Sold: ${Number(item.listing.soldPrice).toLocaleString()}</span>}
                  </div>
                  {item.listing.url && (
                    <a href={item.listing.url} target="_blank" rel="noopener noreferrer"
                      className="text-brand text-xs hover:underline mt-1 inline-block">
                      View on eBay →
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {order.adminNotes && (
        <div className="mt-6 bg-slate-50 rounded-2xl border border-slate-200 p-4">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">Notes from us</p>
          <p className="text-slate-600 text-sm">{order.adminNotes}</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:     "bg-amber-100 text-amber-700",
    received:    "bg-blue-100 text-blue-700",
    in_progress: "bg-purple-100 text-purple-700",
    completed:   "bg-green-100 text-green-700",
    cancelled:   "bg-slate-100 text-slate-500",
  };
  const label: Record<string, string> = {
    pending: "Pending receipt", received: "Received", in_progress: "In progress",
    completed: "Completed", cancelled: "Cancelled",
  };
  return <span className={`text-xs font-semibold px-3 py-1 rounded-full ${map[status] ?? "bg-slate-100 text-slate-500"}`}>{label[status] ?? status}</span>;
}

function Timeline({ status, receivedAt, submittedAt }: {
  status: string; receivedAt: Date | null; submittedAt: Date;
}) {
  const steps = [
    { key: "pending",     label: "Submitted",     date: submittedAt },
    { key: "received",    label: "Cards received", date: receivedAt },
    { key: "in_progress", label: "Being listed",   date: null },
    { key: "completed",   label: "Complete",       date: null },
  ];
  const order = ["pending","received","in_progress","completed"];
  const currentIdx = order.indexOf(status);

  return (
    <div className="flex items-start">
      {steps.map((step, i) => {
        const done    = i <= currentIdx;
        const current = i === currentIdx;
        return (
          <div key={step.key} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${done ? "bg-brand border-brand" : "bg-white border-slate-200"} ${current ? "ring-2 ring-brand/30" : ""}`} />
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${i < currentIdx ? "bg-brand" : "bg-slate-100"}`} />}
            </div>
            <div className="mt-2 text-center px-1">
              <p className={`text-xs font-medium ${done ? "text-navy" : "text-slate-400"}`}>{step.label}</p>
              {step.date && <p className="text-slate-400 text-xs">{new Date(step.date).toLocaleDateString()}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PrintIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
    </svg>
  );
}

