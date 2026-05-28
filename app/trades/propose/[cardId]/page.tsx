import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getLockedCardIds } from "@/lib/trades";
import { ProposeTradeClient } from "./ProposeTradeClient";

export const dynamic = "force-dynamic";

export default async function ProposeTradePage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const myId = session.user.id;

  const targetCard = await db.card.findUnique({
    where: { id: cardId },
    select: {
      id: true, player: true, year: true, manufacturer: true, set: true,
      cardNumber: true, grade: true, gradeCompany: true, photos: true, isTradeable: true,
      owner: { select: { id: true, displayName: true, username: true } },
    },
  });
  if (!targetCard) notFound();
  if (targetCard.owner.id === myId) redirect(`/dashboard/cards/${cardId}`);
  if (!targetCard.isTradeable) notFound();

  // Verify the target card is not already locked
  const lockedTarget = await getLockedCardIds([targetCard.id]);
  if (lockedTarget.has(targetCard.id)) {
    return (
      <div className="max-w-2xl mx-auto p-10 text-center">
        <h1 className="text-2xl font-bold text-navy mb-2">Already in a trade</h1>
        <p className="text-slate-500">This card is already part of an active trade.</p>
      </div>
    );
  }

  // My own tradeable cards (the pool I can pick from to offer)
  const myCards = await db.card.findMany({
    where: { ownerId: myId, isTradeable: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, player: true, year: true, manufacturer: true, set: true,
      cardNumber: true, grade: true, gradeCompany: true, photos: true,
    },
  });
  const lockedMine = await getLockedCardIds(myCards.map(c => c.id));
  const availableMine = myCards.filter(c => !lockedMine.has(c.id));

  return (
    <ProposeTradeClient
      targetCard={targetCard}
      myCards={availableMine}
    />
  );
}
