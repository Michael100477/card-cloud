// Helpers for the trading flow.

import { db } from "./db";

// Statuses considered "open" — a card in any current revision of an open trade is locked.
export const OPEN_TRADE_STATUSES = [
  "proposed", "counter", "accepted",
  "inbound", "received_both",
  "outbound", "disputed",
];

/** Returns the set of cardIds that are currently locked in an open trade. */
export async function getLockedCardIds(cardIds: string[]): Promise<Set<string>> {
  if (cardIds.length === 0) return new Set();
  const rows = await db.tradeRevisionCard.findMany({
    where: {
      cardId: { in: cardIds },
      revision: { trade: { status: { in: OPEN_TRADE_STATUSES } } },
    },
    select: { cardId: true, revisionId: true, revision: { select: { trade: { select: { currentRevisionId: true } } } } },
  });
  const locked = new Set<string>();
  for (const r of rows) {
    if (r.revisionId === r.revision.trade.currentRevisionId) locked.add(r.cardId);
  }
  return locked;
}

/** Throws if any of the given cardIds are already locked in an open trade. */
export async function assertCardsAreUnlocked(cardIds: string[]): Promise<void> {
  const locked = await getLockedCardIds(cardIds);
  if (locked.size > 0) {
    throw new Error(`One or more cards are already part of an open trade: ${[...locked].join(", ")}`);
  }
}
