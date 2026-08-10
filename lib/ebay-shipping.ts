// eBay Sell Logistics client. Used by /admin/shipping → Create Label to buy
// eBay Standard Envelope labels (~$1.29 for cards under $20, <=3 raw cards
// under 1/4" thickness, US domestic). Falls through to EasyPost for anything
// that doesn't qualify.
//
// Sell Logistics scope (sell.logistics) was granted 2026-08-08 on production
// App ID MichaelH-CardClou-PRD-22ed07085-28abc59c. Mike's user token includes
// it as of the 2026-08-09 reconnect.

import { db } from "./db";
import { getAccessToken } from "./ebay-auth";

// ── Env / creds ───────────────────────────────────────────────────────────

async function getCred(service: string): Promise<string | null> {
  const row = await db.siteCredential.findUnique({ where: { service }, select: { value: true } });
  return row?.value || null;
}

async function getApiBase(): Promise<string> {
  const env = (await getCred("ebay_environment")) ?? "production";
  return env === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

// ── Address helpers ──────────────────────────────────────────────────────

export interface EbayContactAddress {
  fullName:        string;
  addressLine1:    string;
  addressLine2?:   string;
  city:            string;
  stateOrProvince: string;
  postalCode:      string;
  countryCode:     string;   // ISO 3166-1 alpha-2
  phoneNumber?:    string;
}

/** Read Card Cloud's ship-from credentials and return an eBay-shaped address. */
export async function getShipFromForEbay(): Promise<EbayContactAddress> {
  const [name, street1, street2, city, state, zip, country, phone] = await Promise.all([
    getCred("shipfrom_name"),
    getCred("shipfrom_street1"),
    getCred("shipfrom_street2"),
    getCred("shipfrom_city"),
    getCred("shipfrom_state"),
    getCred("shipfrom_zip"),
    getCred("shipfrom_country"),
    getCred("shipfrom_phone"),
  ]);
  const missing = [!name && "Name", !street1 && "Street 1", !city && "City", !state && "State", !zip && "ZIP"]
    .filter(Boolean) as string[];
  if (missing.length > 0) {
    throw new Error(`Ship-from address incomplete for eBay Standard Envelope — fill in: ${missing.join(", ")} (Admin → API Keys → Shipping — From Address)`);
  }
  return {
    fullName:        name!,
    addressLine1:    street1!,
    addressLine2:    street2 || undefined,
    city:            city!,
    stateOrProvince: state!,
    postalCode:      zip!,
    countryCode:     (country || "US").toUpperCase(),
    phoneNumber:     phone || undefined,
  };
}

// ── Eligibility ──────────────────────────────────────────────────────────

export interface EligibilityInput {
  destinationCountryCode: string;  // ISO alpha-2, e.g. "US"
  orderTotalUsd:          number;
  cardCount:              number;
  allRaw:                 boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  reason:   string | null;   // first failure reason, or null when eligible
  signals: {
    countryUS:     boolean;
    underValueCap: boolean;
    cardCountOk:   boolean;
    allRaw:        boolean;
  };
}

/** Card Cloud's Standard Envelope eligibility rules:
 *    - US domestic only
 *    - Order total <= $20 (eBay's declared-value cap for this service)
 *    - <=3 cards per order
 *    - All raw (graded slabs exceed the 1/4" thickness limit)
 */
export function evaluateStandardEnvelopeEligibility(input: EligibilityInput): EligibilityResult {
  const signals = {
    countryUS:     input.destinationCountryCode.toUpperCase() === "US",
    underValueCap: input.orderTotalUsd <= 20,
    cardCountOk:   input.cardCount >= 1 && input.cardCount <= 3,
    allRaw:        input.allRaw,
  };
  const failures: string[] = [];
  if (!signals.countryUS)     failures.push(`ship-to country is ${input.destinationCountryCode} (Standard Envelope is US-only)`);
  if (!signals.underValueCap) failures.push(`order total $${input.orderTotalUsd.toFixed(2)} exceeds Standard Envelope's $20 cap`);
  if (!signals.cardCountOk)   failures.push(`${input.cardCount}-card order (Standard Envelope caps at 3)`);
  if (!signals.allRaw)        failures.push("order contains a graded slab (exceeds 1/4\" thickness)");
  return { eligible: failures.length === 0, reason: failures[0] ?? null, signals };
}

/** Weight rule Mike set 2026-08-10: 1 card = 1oz, 2 cards = 2oz, 3 cards = 3oz.
 *  Returns 1 for anything <=1, 3 for anything >=3, else the exact count. */
export function estimateStandardEnvelopeWeightOz(cardCount: number): number {
  return Math.min(3, Math.max(1, cardCount));
}

// ── Quote endpoint ───────────────────────────────────────────────────────

export interface PackageSpec {
  weightOz: number;
  lengthIn: number;
  widthIn:  number;
  heightIn: number;
}

export interface EbayRate {
  rateId:           string;
  shippingCarrier:  string;   // "USPS" typically
  serviceType:      string;   // eBay's enum, e.g. "USPS_STANDARD_ENVELOPE"
  serviceLabel:     string;   // human-readable name if eBay returns one
  baseCostUsd:      number;
  totalCostUsd:     number;
  raw:              unknown;
}

export interface ShippingQuote {
  quoteId:              string;
  rates:                EbayRate[];
  standardEnvelopeRate: EbayRate | null;
  raw:                  unknown;   // full response for debugging on first prod call
}

/** Case-insensitive check for whether a serviceType/label refers to Standard Envelope. */
function isStandardEnvelope(rate: { serviceType?: string; serviceLabel?: string }): boolean {
  const hay = `${rate.serviceType ?? ""} ${rate.serviceLabel ?? ""}`.toLowerCase().replace(/[_\s]+/g, " ");
  return hay.includes("standard envelope");
}

export async function getShippingQuote(params: {
  shipFrom:    EbayContactAddress;
  shipTo:      EbayContactAddress;
  packageSpec: PackageSpec;
  /** Required by eBay: the order this quote is for. Standard Envelope
   *  eligibility is determined per-order (declared value, item category). */
  ebayOrderId: string;
}): Promise<ShippingQuote> {
  const apiBase = await getApiBase();
  const token   = await getAccessToken();

  const body = {
    accountCurrencyCode: "USD",
    orders: [{ orderId: params.ebayOrderId }],
    shipFrom: contactBlock(params.shipFrom),
    shipTo:   contactBlock(params.shipTo),
    packageSpecifications: {
      packages: [{
        packageType: "PACKAGE",
        weight:     { value: params.packageSpec.weightOz, unit: "OUNCE" },
        dimensions: {
          length: params.packageSpec.lengthIn,
          width:  params.packageSpec.widthIn,
          height: params.packageSpec.heightIn,
          unit:   "INCH",
        },
      }],
    },
  };

  const r = await fetch(`${apiBase}/sell/logistics/v1_beta/shipping_quote`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  const raw = await r.json();
  if (!r.ok) {
    throw new Error(`eBay shipping_quote failed (${r.status}): ${JSON.stringify(raw).slice(0, 500)}`);
  }

  type RawRate = {
    rateId?: string;
    shippingCarrierCode?: string;
    serviceType?: string;
    additionalOptions?: unknown;
    baseShippingCost?:  { value?: string | number; currency?: string };
    totalShippingCost?: { value?: string | number; currency?: string };
    [k: string]: unknown;
  };
  const rates: EbayRate[] = (Array.isArray(raw.rates) ? raw.rates : []).map((rate: RawRate) => ({
    rateId:          rate.rateId ?? "",
    shippingCarrier: rate.shippingCarrierCode ?? "USPS",
    serviceType:     rate.serviceType ?? "",
    serviceLabel:    rate.serviceType ?? "",   // eBay's beta responses don't always include a friendly label
    baseCostUsd:     parseFloat(String(rate.baseShippingCost?.value  ?? rate.totalShippingCost?.value ?? "0")),
    totalCostUsd:    parseFloat(String(rate.totalShippingCost?.value ?? rate.baseShippingCost?.value  ?? "0")),
    raw:             rate,
  }));

  return {
    quoteId:              raw.shippingQuoteId ?? raw.quoteId ?? "",
    rates,
    standardEnvelopeRate: rates.find(isStandardEnvelope) ?? null,
    raw,
  };
}

function contactBlock(addr: EbayContactAddress) {
  return {
    contactAddress: {
      addressLine1:    addr.addressLine1,
      ...(addr.addressLine2 && { addressLine2: addr.addressLine2 }),
      city:            addr.city,
      stateOrProvince: addr.stateOrProvince,
      postalCode:      addr.postalCode,
      countryCode:     addr.countryCode,
    },
    fullName: addr.fullName,
    ...(addr.phoneNumber && { primaryPhone: { phoneNumber: addr.phoneNumber } }),
  };
}

// ── Shipment (buy the label) ─────────────────────────────────────────────

export interface BoughtShipment {
  shipmentId:       string;
  trackingNumber:   string;
  labelDownloadUrl: string;
  actualCostUsd:    number;
  serviceType:      string;
  carrier:          string;
  raw:              unknown;
}

/** Commit to a rate on a previously-created quote and buy the label. */
export async function buyShippingLabel(params: {
  rateId:  string;
  /** Optional: eBay order ID to link the shipment to for auto-fulfillment (buyer notification). */
  ebayOrderId?: string;
}): Promise<BoughtShipment> {
  const apiBase = await getApiBase();
  const token   = await getAccessToken();

  const body: Record<string, unknown> = {
    rateId: params.rateId,
    labelSize: "4x6",
    ...(params.ebayOrderId && {
      additionalOptions: [
        { optionType: "ORDER_ID", optionValue: params.ebayOrderId },
      ],
    }),
  };

  const r = await fetch(`${apiBase}/sell/logistics/v1_beta/shipment`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  const raw = await r.json();
  if (!r.ok) {
    throw new Error(`eBay shipment create failed (${r.status}): ${JSON.stringify(raw).slice(0, 500)}`);
  }

  type Label = { downloadUrl?: string; labelDownloadUrl?: string; labelFormat?: string };
  const label: Label = Array.isArray(raw.labels) && raw.labels.length > 0 ? raw.labels[0] : {};

  return {
    shipmentId:       raw.shipmentId ?? "",
    trackingNumber:   raw.shipmentTrackingNumber ?? raw.trackingNumber ?? "",
    labelDownloadUrl: label.downloadUrl ?? label.labelDownloadUrl ?? raw.labelDownloadUrl ?? "",
    actualCostUsd:    parseFloat(String(raw.shippingCost?.baseCharge?.value ?? raw.totalShippingCost?.value ?? "0")),
    serviceType:      raw.serviceType ?? "",
    carrier:          raw.shippingCarrierCode ?? "USPS",
    raw,
  };
}

// ── Label PDF/PNG download ───────────────────────────────────────────────

export async function getLabelBinary(shipmentId: string, format: "PDF" | "PNG" = "PDF"): Promise<Buffer> {
  const apiBase = await getApiBase();
  const token   = await getAccessToken();
  const r = await fetch(`${apiBase}/sell/logistics/v1_beta/shipment/${shipmentId}/shipping_label`, {
    headers: { Authorization: `Bearer ${token}`, Accept: format === "PDF" ? "application/pdf" : "image/png" },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`eBay label download failed (${r.status}): ${body.slice(0, 300)}`);
  }
  return Buffer.from(await r.arrayBuffer());
}

// ── Void a label (must be before first scan) ─────────────────────────────

export async function voidShippingLabel(shipmentId: string): Promise<void> {
  const apiBase = await getApiBase();
  const token   = await getAccessToken();
  const r = await fetch(`${apiBase}/sell/logistics/v1_beta/shipment/${shipmentId}/cancel`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`eBay shipment cancel failed (${r.status}): ${body.slice(0, 300)}`);
  }
}
