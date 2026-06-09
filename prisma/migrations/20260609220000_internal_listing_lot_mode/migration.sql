-- Add card-lot mode columns to internal_listings. When isLot=true, the
-- listing represents multiple cards bundled together (Trading Card Lots
-- category on eBay) rather than a single card; cardCount stores how many.

ALTER TABLE "internal_listings"
  ADD COLUMN "isLot"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cardCount" INTEGER;
