-- Freeform list of cards included in a lot listing. Used by the description
-- generator to produce a lot-style description instead of a single-card one.

ALTER TABLE "internal_listings"
  ADD COLUMN "lotContents" TEXT;
