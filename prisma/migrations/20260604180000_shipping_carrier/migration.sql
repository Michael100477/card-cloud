-- Add shippingCarrier column to the listing tables so we can render
-- carrier-aware tracking links (USPS, UPS, FedEx, DHL).
ALTER TABLE "internal_listings" ADD COLUMN "shippingCarrier" TEXT;
ALTER TABLE "ebay_listings"     ADD COLUMN "shippingCarrier" TEXT;
