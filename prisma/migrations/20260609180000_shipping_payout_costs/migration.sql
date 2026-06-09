-- Add cost-breakdown columns to internal_listings and ebay_listings for the
-- Payout tab. Postage + supply costs are captured at ship time; eBay payout
-- and fee amounts are populated by the Finances API sync.

ALTER TABLE "internal_listings"
  ADD COLUMN "shippingPostageCost" DECIMAL(10,2),
  ADD COLUMN "shippingSupplyCost"  DECIMAL(10,2),
  ADD COLUMN "ebayPayoutAmount"    DECIMAL(10,2),
  ADD COLUMN "ebayFeeAmount"       DECIMAL(10,2);

ALTER TABLE "ebay_listings"
  ADD COLUMN "shippingPostageCost" DECIMAL(10,2),
  ADD COLUMN "shippingSupplyCost"  DECIMAL(10,2),
  ADD COLUMN "ebayPayoutAmount"    DECIMAL(10,2),
  ADD COLUMN "ebayFeeAmount"       DECIMAL(10,2);
