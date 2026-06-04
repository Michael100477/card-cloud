-- Persist the buyer's eBay username so we can send them a message via
-- AddMemberMessageAAQToPartner without re-querying eBay.
ALTER TABLE "internal_listings" ADD COLUMN "buyerUsername" TEXT;
ALTER TABLE "ebay_listings"     ADD COLUMN "buyerUsername" TEXT;
