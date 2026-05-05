/**
 * Internal snapshot helper — not a server action.
 * Called automatically from card/collection mutations so every change
 * to a collection's composition is recorded.
 *
 * Phase 2: the eBay value-refresh background job will also call this
 * after updating card estimatedValues, capturing value movement over time.
 */

import { db } from "@/lib/db";

export async function recordSnapshot(collectionId: string): Promise<void> {
  try {
    const links = await db.cardCollection.findMany({
      where: { collectionId },
      include: { card: { select: { estimatedValue: true } } },
    });

    const totalValue = links.reduce(
      (sum, { card }) => sum + (Number(card.estimatedValue) || 0),
      0
    );

    await db.collectionSnapshot.create({
      data: { collectionId, totalValue, cardCount: links.length },
    });
  } catch (err) {
    // Non-fatal — snapshot failure should never break the main operation
    console.error("[recordSnapshot]", err);
  }
}
