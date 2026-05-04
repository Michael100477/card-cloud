"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

async function requireOwner(collectionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const col = await db.collection.findFirst({
    where: { id: collectionId, ownerId: session.user.id },
    select: { id: true },
  });
  if (!col) throw new Error("Not found.");
  return session.user.id;
}

// Records the current total value of a collection as a snapshot.
// Called manually now; Phase 2's eBay refresh job will call this
// automatically after updating card estimatedValues.
export async function recordSnapshotAction(collectionId: string) {
  await requireOwner(collectionId);

  const links = await db.cardCollection.findMany({
    where: { collectionId },
    include: { card: { select: { estimatedValue: true } } },
  });

  const totalValue = links.reduce(
    (sum, { card }) => sum + (card.estimatedValue ? Number(card.estimatedValue) : 0),
    0
  );

  await db.collectionSnapshot.create({
    data: { collectionId, totalValue, cardCount: links.length },
  });

  revalidatePath(`/dashboard/collections/${collectionId}`);
  return { success: true, totalValue, cardCount: links.length };
}

// Deletes a snapshot (admin / testing use).
export async function deleteSnapshotAction(snapshotId: string, collectionId: string) {
  await requireOwner(collectionId);
  await db.collectionSnapshot.delete({ where: { id: snapshotId } });
  revalidatePath(`/dashboard/collections/${collectionId}`);
}
