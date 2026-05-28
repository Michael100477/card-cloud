import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TradeDetailClient } from "./TradeDetailClient";

export const dynamic = "force-dynamic";

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const myId = session.user.id;

  const trade = await db.trade.findUnique({
    where: { id },
    include: {
      initiator: { select: { id: true, displayName: true, username: true } },
      target:    { select: { id: true, displayName: true, username: true } },
      revisions: {
        orderBy: { createdAt: "desc" },
        include: {
          proposedBy: { select: { id: true, displayName: true, username: true } },
          cards: { include: { card: { select: {
            id: true, player: true, year: true, manufacturer: true, set: true,
            cardNumber: true, grade: true, gradeCompany: true, photos: true,
            estimatedValue: true,
          } } } },
        },
      },
    },
  });
  if (!trade) notFound();
  if (trade.initiatorId !== myId && trade.targetId !== myId) redirect("/trades/my");

  // My counter-offer would need to pull from my tradeable cards
  const myTradeableCards = await db.card.findMany({
    where: { ownerId: myId, isTradeable: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, player: true, year: true, manufacturer: true, set: true,
      cardNumber: true, grade: true, gradeCompany: true, photos: true,
    },
  });

  // Serialize Decimals and Dates
  const serialized = {
    ...trade,
    revisions: trade.revisions.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      cards: r.cards.map(c => ({
        ...c,
        card: { ...c.card, estimatedValue: c.card.estimatedValue ? Number(c.card.estimatedValue) : null },
      })),
    })),
    createdAt: trade.createdAt.toISOString(),
    updatedAt: trade.updatedAt.toISOString(),
    initiatorInboundReceivedAt: trade.initiatorInboundReceivedAt?.toISOString() ?? null,
    targetInboundReceivedAt:    trade.targetInboundReceivedAt?.toISOString() ?? null,
    initiatorOutboundShippedAt: trade.initiatorOutboundShippedAt?.toISOString() ?? null,
    targetOutboundShippedAt:    trade.targetOutboundShippedAt?.toISOString() ?? null,
    initiatorReceivedAt:        trade.initiatorReceivedAt?.toISOString() ?? null,
    targetReceivedAt:           trade.targetReceivedAt?.toISOString() ?? null,
    disputeOpenedAt:            trade.disputeOpenedAt?.toISOString() ?? null,
  };

  return <TradeDetailClient trade={serialized} myId={myId} myTradeableCards={myTradeableCards} />;
}
