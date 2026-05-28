import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCommissionRates } from "@/lib/commission";
import { ConsignForm } from "./ConsignForm";

interface Props { searchParams: Promise<{ cardId?: string }> }

export default async function ConsignPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { cardId } = await searchParams;

  // Load return address from user profile
  const userProfile = await db.user.findUnique({
    where:  { id: session.user.id },
    select: {
      fullName: true, displayName: true, phone: true,
      addressLine1: true, addressLine2: true,
      city: true, state: true, zip: true, country: true,
    },
  });

  // Load user's collection so the form can offer "add from collection"
  const cards = await db.card.findMany({
    where:   { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, player: true, year: true, manufacturer: true, set: true,
      subset: true, cardNumber: true, sport: true, grade: true, gradeCompany: true,
      certNumber: true, serialNumber: true, tags: true, photos: true,
    },
  });

  // If a specific card was clicked, pre-seed the form with it
  const [startCard, rates] = await Promise.all([
    Promise.resolve(cardId ? cards.find(c => c.id === cardId) ?? null : null),
    getCommissionRates(),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-navy text-2xl font-bold">Consign your cards</h1>
        <p className="text-slate-500 text-sm mt-1">
          List the cards you&apos;d like us to sell on your behalf. We&apos;ll photograph, list on eBay, and pay you when they sell.
        </p>
      </div>
      <ConsignForm
        collectionCards={cards}
        startCard={startCard}
        commissionRates={rates}
        returnInfo={userProfile}
      />
    </div>
  );
}
