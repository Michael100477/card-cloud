import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { AdminTradeClient } from "./AdminTradeClient";

export const dynamic = "force-dynamic";

interface SearchParams { side?: string }

export default async function AdminTradeDetailPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const sp     = await searchParams;
  const focusSide = sp.side === "initiator" || sp.side === "target" ? sp.side : null;

  const trade = await db.trade.findUnique({
    where: { id },
    include: {
      initiator: { select: { id: true, displayName: true, username: true, email: true } },
      target:    { select: { id: true, displayName: true, username: true, email: true } },
      revisions: {
        orderBy: { createdAt: "desc" },
        include: { cards: { include: { card: { select: {
          id: true, player: true, year: true, manufacturer: true, set: true,
          cardNumber: true, grade: true, gradeCompany: true,
        } } } } },
      },
    },
  });
  if (!trade) notFound();

  const current = trade.revisions.find(r => r.id === trade.currentRevisionId) ?? trade.revisions[0];
  const initiatorCards = current?.cards.filter(c => c.side === "initiator") ?? [];
  const targetCards    = current?.cards.filter(c => c.side === "target")    ?? [];

  return (
    <div className="p-8">
      <Link href="/admin/trades" className="text-slate-400 text-sm hover:text-navy">← All trades</Link>

      <div className="flex items-end justify-between mt-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Trade #{trade.id.slice(-8).toUpperCase()}</h1>
          <p className="text-slate-400 text-sm mt-0.5">Status: <span className="font-semibold text-navy">{trade.status}</span></p>
        </div>
      </div>

      <AdminTradeClient
        trade={{
          ...trade,
          createdAt: trade.createdAt.toISOString(),
          updatedAt: trade.updatedAt.toISOString(),
          initiatorInboundReceivedAt: trade.initiatorInboundReceivedAt?.toISOString() ?? null,
          targetInboundReceivedAt:    trade.targetInboundReceivedAt?.toISOString() ?? null,
          initiatorOutboundShippedAt: trade.initiatorOutboundShippedAt?.toISOString() ?? null,
          targetOutboundShippedAt:    trade.targetOutboundShippedAt?.toISOString() ?? null,
          initiatorReceivedAt:        trade.initiatorReceivedAt?.toISOString()        ?? null,
          targetReceivedAt:           trade.targetReceivedAt?.toISOString()           ?? null,
          disputeOpenedAt:            trade.disputeOpenedAt?.toISOString()            ?? null,
        }}
        initiatorCards={initiatorCards}
        targetCards={targetCards}
        focusSide={focusSide}
      />
    </div>
  );
}
