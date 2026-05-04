-- Find orphan cards (not linked to any collection)
SELECT c.id, c.player, c.year, c.set
FROM cards c
LEFT JOIN card_collections cc ON cc."cardId" = c.id
WHERE cc."cardId" IS NULL;

-- Delete them
DELETE FROM cards
WHERE id NOT IN (SELECT "cardId" FROM card_collections);
