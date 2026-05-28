import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { AddCardForm } from "@/components/cards/AddCardForm";

interface Props {
  searchParams: Promise<{ collection?: string }>;
}

export default async function NewCardPage({ searchParams }: Props) {
  const { collection: collectionId } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Verify the collection belongs to the user (if one was passed)
  let collection: { id: string; name: string } | null = null;
  if (collectionId) {
    collection = await db.collection.findFirst({
      where:  { id: collectionId, ownerId: session.user.id },
      select: { id: true, name: true },
    });
  }

  // When no collection is pre-selected, pass all collections so the form can show a picker
  const collections = !collection
    ? await db.collection.findMany({
        where:   { ownerId: session.user.id },
        select:  { id: true, name: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <AddCardForm collection={collection} collections={collections} />
    </div>
  );
}
