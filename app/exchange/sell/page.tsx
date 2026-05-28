import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ExchangeSellForm } from "./ExchangeSellForm";

interface Props {
  searchParams: Promise<{ cardId?: string }>;
}

export default async function ExchangeSellPage({ searchParams }: Props) {
  const { cardId } = await searchParams;

  if (!cardId) redirect("/dashboard");

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const card = await db.card.findUnique({
    where:  { id: cardId },
    select: {
      id:           true,
      player:       true,
      year:         true,
      manufacturer: true,
      set:          true,
      grade:        true,
      gradeCompany: true,
      photos:       true,
      sport:        true,
      ownerId:      true,
    },
  });

  if (!card || card.ownerId !== session.user.id) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-navy font-semibold text-lg">Card not found</p>
        <p className="text-slate-400 text-sm mt-1">
          This card doesn&apos;t exist or doesn&apos;t belong to your collection.
        </p>
      </div>
    );
  }

  const cardForForm = {
    id:           card.id,
    player:       card.player,
    year:         card.year,
    manufacturer: card.manufacturer,
    set:          card.set,
    grade:        card.grade,
    gradeCompany: card.gradeCompany,
    photos:       card.photos,
    sport:        card.sport,
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <ExchangeSellForm card={cardForForm} />
    </div>
  );
}
