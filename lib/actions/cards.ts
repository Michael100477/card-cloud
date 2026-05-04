"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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
      }
    }

    revalidatePath("/dashboard");
    return { success: true, cardId: card.id };
  } catch (err) {
    console.error("[createCardAction]", err);
    return { error: "Failed to save card. Please try again." };
  }
}

export async function deleteCardAction(cardId: string) {
  const userId = await requireAuth();

  const card = await db.card.findUnique({ where: { id: cardId } });
  if (!card || card.ownerId !== userId) return { error: "Not found." };

  await db.card.delete({ where: { id: cardId } });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
