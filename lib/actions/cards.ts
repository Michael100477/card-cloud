"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { recordSnapshot } from "@/lib/snapshots";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export interface CreateCardInput {
  player: string;
  year: number;
  manufacturer: string;
  set: string;
  subset?: string;
  cardNumber?: string;
  sport?: string;
  team?: string;
  gradeCompany?: string;
  grade?: string;
  certNumber?: string;
  serialNumber?: string;
  tags: string[];
  bgsSubCentering?: number;
  bgsSubCorners?:   number;
  bgsSubEdges?:     number;
  bgsSubSurface?:   number;
  conditionNotes?: string;
  photos: string[];           // R2 URLs — empty until storage is wired up
  notes?: string;
  acquiredDate?: string;
  acquiredPrice?: number;
  acquiredSource?: string;
  collectionId?: string;
}

export async function createCardAction(data: CreateCardInput) {
  const userId = await requireAuth();

  if (!data.player?.trim() || !data.year || !data.manufacturer?.trim() || !data.set?.trim()) {
    return { error: "Player, year, manufacturer, and set are required." };
  }

  try {
    const card = await db.card.create({
      data: {
        ownerId:       userId,
        player:        data.player.trim(),
        year:          data.year,
        manufacturer:  data.manufacturer.trim(),
        set:           data.set.trim(),
        subset:        data.subset?.trim()      || null,
        cardNumber:    data.cardNumber?.trim()  || null,
        sport:         data.sport               || null,
        team:          data.team?.trim()        || null,
        grade:         data.grade?.trim()       || null,
        gradeCompany:  data.gradeCompany        || null,
        certNumber:    data.certNumber?.trim()   || null,
        serialNumber:  data.serialNumber?.trim() || null,
        tags:          data.tags,
        bgsSubCentering: data.bgsSubCentering ?? null,
        bgsSubCorners:   data.bgsSubCorners   ?? null,
        bgsSubEdges:     data.bgsSubEdges     ?? null,
        bgsSubSurface:   data.bgsSubSurface   ?? null,
        conditionNotes: data.conditionNotes?.trim() || null,
        notes:          data.notes?.trim()          || null,
        photos:        data.photos,
        acquiredDate:  data.acquiredDate ? new Date(data.acquiredDate) : null,
        acquiredPrice: data.acquiredPrice ?? null,
        acquiredSource: data.acquiredSource || null,
      },
    });

    // Link to collection if one was specified
    if (data.collectionId) {
      const col = await db.collection.findFirst({
        where: { id: data.collectionId, ownerId: userId },
      });
      if (col) {
        await db.cardCollection.create({
          data: { cardId: card.id, collectionId: data.collectionId },
        });
        revalidatePath(`/dashboard/collections/${data.collectionId}`);
        // Record value snapshot — non-blocking, runs after card is linked
        void recordSnapshot(data.collectionId);
      }
    }

    revalidatePath("/dashboard");
    return { success: true, cardId: card.id };
  } catch (err) {
    console.error("[createCardAction]", err);
    return { error: "Failed to save card. Please try again." };
  }
}

// Re-uses CreateCardInput minus collectionId (collection membership
// is managed separately; editing doesn't move a card between collections)
export type UpdateCardInput = Omit<CreateCardInput, "collectionId">;

export async function updateCardAction(cardId: string, data: UpdateCardInput) {
  const userId = await requireAuth();

  if (!data.player?.trim() || !data.year || !data.manufacturer?.trim() || !data.set?.trim()) {
    return { error: "Player, year, manufacturer, and set are required." };
  }

  const existing = await db.card.findUnique({ where: { id: cardId }, select: { ownerId: true } });
  if (!existing || existing.ownerId !== userId) return { error: "Card not found." };

  try {
    await db.card.update({
      where: { id: cardId },
      data: {
        player:        data.player.trim(),
        year:          data.year,
        manufacturer:  data.manufacturer.trim(),
        set:           data.set.trim(),
        subset:        data.subset?.trim()       || null,
        cardNumber:    data.cardNumber?.trim()   || null,
        sport:         data.sport                || null,
        team:          data.team?.trim()         || null,
        grade:         data.grade?.trim()        || null,
        gradeCompany:  data.gradeCompany         || null,
        certNumber:    data.certNumber?.trim()   || null,
        serialNumber:  data.serialNumber?.trim() || null,
        tags:          data.tags,
        bgsSubCentering: data.bgsSubCentering ?? null,
        bgsSubCorners:   data.bgsSubCorners   ?? null,
        bgsSubEdges:     data.bgsSubEdges     ?? null,
        bgsSubSurface:   data.bgsSubSurface   ?? null,
        conditionNotes: data.conditionNotes?.trim() || null,
        notes:          data.notes?.trim()          || null,
        photos:        data.photos,
        acquiredDate:  data.acquiredDate ? new Date(data.acquiredDate) : null,
        acquiredPrice: data.acquiredPrice ?? null,
        acquiredSource: data.acquiredSource || null,
      },
    });

    revalidatePath(`/dashboard/cards/${cardId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[updateCardAction]", err);
    return { error: "Failed to save changes. Please try again." };
  }
}

export async function removeFromCollectionAction(cardId: string, collectionId: string) {
  const userId = await requireAuth();

  const card = await db.card.findUnique({ where: { id: cardId }, select: { ownerId: true } });
  if (!card || card.ownerId !== userId) return { error: "Not found." };

  await db.cardCollection.deleteMany({ where: { cardId, collectionId } });

  // If this was the card's only collection it now has no home — delete it
  // entirely rather than leaving an orphan the user can't access.
  const remaining = await db.cardCollection.count({ where: { cardId } });
  if (remaining === 0) {
    await db.card.delete({ where: { id: cardId } });
  }

  // Record snapshot of the collection's new value after removal
  void recordSnapshot(collectionId);

  revalidatePath(`/dashboard/collections/${collectionId}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/collections/${collectionId}`);
}

// Returns how many collections a card belongs to — used by CardActions
// to show accurate confirmation copy before the user commits.
export async function getCardCollectionCountAction(cardId: string) {
  const session = await auth();
  if (!session?.user?.id) return 0;
  return db.cardCollection.count({ where: { cardId } });
}

export async function deleteCardAction(cardId: string) {
  const userId = await requireAuth();

  const card = await db.card.findUnique({ where: { id: cardId } });
  if (!card || card.ownerId !== userId) return { error: "Not found." };

  await db.card.delete({ where: { id: cardId } });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
