import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { EditCardForm } from "@/components/cards/EditCardForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCardPage({ params }: Props) {
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

  // Serialise Decimal fields before crossing the server→client boundary
  const initial = {
    id:             card.id,
    player:         card.player,
    year:           card.year,
    manufacturer:   card.manufacturer,
    set:            card.set,
    subset:         card.subset         ?? "",
    cardNumber:     card.cardNumber     ?? "",
    serialNumber:   card.serialNumber   ?? "",
    sport:          card.sport          ?? "",
    team:           card.team           ?? "",
    gradeCompany:   card.gradeCompany   ?? "",
    grade:          card.grade          ?? "",
    certNumber:     card.certNumber     ?? "",
    tags:           card.tags,
    conditionNotes: card.conditionNotes ?? "",
    notes:          card.notes          ?? "",
    photos:         card.photos,
    acquiredDate:   card.acquiredDate
                      ? card.acquiredDate.toISOString().split("T")[0]
                      : "",
    acquiredPrice:  card.acquiredPrice ? String(Number(card.acquiredPrice)) : "",
    acquiredSource: card.acquiredSource ?? "",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <EditCardForm initial={initial} collection={primaryCollection} />
    </div>
  );
}
