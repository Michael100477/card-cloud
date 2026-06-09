// EasyPost shipping client. Used by /admin/shipping → Create label to:
//   1. Build a from + to address pair
//   2. Build a parcel object (weight + dimensions)
//   3. Create a Shipment to fetch rates from USPS
//   4. Buy the cheapest USPS Ground Advantage label (or Priority for higher value)
//   5. Return labelUrl + trackingNumber + carrier + cost
//
// The eBay "shipping_fulfillment" call that notifies the buyer happens
// separately in create-label/route.ts after we successfully buy here.

import EasyPost from "@easypost/api";
import { db } from "./db";

async function getCred(service: string): Promise<string | null> {
  const row = await db.siteCredential.findUnique({ where: { service }, select: { value: true } });
  return row?.value || null;
}

async function getSetting(key: string, fallback: number): Promise<number> {
  const row = await db.siteSetting.findUnique({ where: { key }, select: { value: true } });
  const v = parseFloat(row?.value ?? "");
  return isNaN(v) ? fallback : v;
}

/** Compute the per-shipment supply cost from current settings. Captured as
 *  a frozen snapshot on each ship-time write so retroactive rate changes
 *  don't move historical numbers in the Payout tab. */
export async function computeSupplyCost(): Promise<number> {
  const [envelope, label, packingSlip, tapePerInch, tapeInches] = await Promise.all([
    getSetting("supply_cost_envelope",         0.20),
    getSetting("supply_cost_label",            0.10),
    getSetting("supply_cost_packing_slip",     0.02),
    getSetting("supply_cost_tape_per_inch",    0),
    getSetting("supply_tape_inches_per_order", 0),
  ]);
  return Math.round((envelope + label + packingSlip + (tapePerInch * tapeInches)) * 100) / 100;
}

/** Read all ship-from credential fields and assemble an EasyPost address payload. */
export async function getShipFromAddress(): Promise<EasyPost.IAddressCreateParameters> {
  const [name, company, street1, street2, city, state, zip, country, phone] = await Promise.all([
    getCred("shipfrom_name"),
    getCred("shipfrom_company"),
    getCred("shipfrom_street1"),
    getCred("shipfrom_street2"),
    getCred("shipfrom_city"),
    getCred("shipfrom_state"),
    getCred("shipfrom_zip"),
    getCred("shipfrom_country"),
    getCred("shipfrom_phone"),
  ]);
  const missing = [
    !name && "Sender Name",
    !street1 && "Street 1",
    !city && "City",
    !state && "State",
    !zip && "ZIP",
  ].filter(Boolean) as string[];
  if (missing.length > 0) {
    throw new Error(`Ship-from address incomplete — fill in: ${missing.join(", ")}. (Admin → API Keys → Shipping — From Address)`);
  }
  return {
    name:    name!,
    company: company || undefined,
    street1: street1!,
    street2: street2 || undefined,
    city:    city!,
    state:   state!,
    zip:     zip!,
    country: country || "US",
    phone:   phone || undefined,
  };
}

async function getClient(): Promise<EasyPost> {
  const env  = (await getCred("easypost_environment")) ?? "test";
  const key  = env === "production"
    ? await getCred("easypost_prod_key")
    : await getCred("easypost_test_key");
  if (!key) throw new Error(`EasyPost ${env} API key is not configured. (Admin → API Keys → Shipping — EasyPost)`);
  return new EasyPost(key);
}

export interface BuyLabelInput {
  to: EasyPost.IAddressCreateParameters;
  parcel: {
    length:  number;  // inches
    width:   number;
    height:  number;
    weight:  number;  // ounces (NOT pounds)
  };
  /** USD value of the items being shipped — used to pick a service tier. */
  insuranceValue?: number;
  /** Force a specific service. If omitted, picks the cheapest USPS rate. */
  preferredService?: "GroundAdvantage" | "Priority" | "PriorityExpress";
}

export interface BuyLabelResult {
  labelUrl:       string;
  trackingNumber: string;
  carrier:        string;
  service:        string;
  cost:           number;   // postage in USD
}

export interface RateInfo {
  id:              string;
  carrier:         string;
  service:         string;
  rate:            number;   // USD
  currency:        string;
  deliveryDays?:   number;
  estDeliveryDays?: number;
  deliveryDate?:   string | null;
}

export interface QuoteResult {
  shipmentId: string;
  rates:      RateInfo[];
}

/** Two-step labeling helper: create a shipment with EasyPost and return all
 *  the available USPS rates without buying anything. Use buyRate() to commit
 *  to a specific rate after the user picks one. */
export async function getRates(input: BuyLabelInput): Promise<QuoteResult> {
  const client = await getClient();
  const from = await getShipFromAddress();

  const shipment = await client.Shipment.create({
    to_address:   input.to,
    from_address: from,
    parcel: {
      length: input.parcel.length,
      width:  input.parcel.width,
      height: input.parcel.height,
      weight: input.parcel.weight,
    },
    options: {
      label_format: "PNG",
      label_size:   "4x6",
    },
  });

  const rates: RateInfo[] = (shipment.rates ?? [])
    .filter(r => r.carrier === "USPS")
    .map(r => ({
      id:               r.id,
      carrier:          r.carrier ?? "USPS",
      service:          r.service ?? "Unknown",
      rate:             parseFloat(r.rate ?? "0"),
      currency:         r.currency ?? "USD",
      deliveryDays:     r.delivery_days     ?? undefined,
      estDeliveryDays:  r.est_delivery_days ?? undefined,
      deliveryDate:     r.delivery_date     ?? null,
    }))
    .sort((a, b) => a.rate - b.rate);

  return { shipmentId: shipment.id, rates };
}

/** Buy the chosen rate on a previously-created shipment. */
export async function buyRate(shipmentId: string, rateId: string): Promise<BuyLabelResult> {
  const client = await getClient();
  const shipment = await client.Shipment.retrieve(shipmentId);
  const rate = shipment.rates?.find((r: EasyPost.IRate) => r.id === rateId);
  if (!rate) throw new Error(`Rate ${rateId} not found on shipment ${shipmentId}. The quote may have expired — get a fresh quote.`);

  const bought = await client.Shipment.buy(shipmentId, rate);

  const labelUrl       = bought.postage_label?.label_url ?? "";
  const trackingNumber = bought.tracking_code           ?? "";
  if (!labelUrl || !trackingNumber) {
    throw new Error(`EasyPost label purchase succeeded but did not return URL or tracking. Got: ${JSON.stringify({ labelUrl, trackingNumber }).slice(0, 200)}`);
  }

  return {
    labelUrl,
    trackingNumber,
    carrier: bought.selected_rate?.carrier ?? "USPS",
    service: bought.selected_rate?.service ?? "Unknown",
    cost:    parseFloat(bought.selected_rate?.rate ?? "0"),
  };
}

/**
 * Create + buy a shipping label via EasyPost. Returns label URL, tracking
 * number, carrier, and cost. Throws if anything along the way fails — the
 * caller is responsible for surfacing a useful error to the UI.
 */
export async function buyLabel(input: BuyLabelInput): Promise<BuyLabelResult> {
  const client = await getClient();
  const from = await getShipFromAddress();

  const shipment = await client.Shipment.create({
    to_address:   input.to,
    from_address: from,
    parcel: {
      length: input.parcel.length,
      width:  input.parcel.width,
      height: input.parcel.height,
      weight: input.parcel.weight,
    },
    // PNG is the most flexible format to embed and position on a custom
    // print page (PDFs require iframes which lose CSS print positioning).
    // Our /admin/shipping/print route handles the bottom-of-page layout.
    options: {
      label_format: "PNG",
      label_size:   "4x6",
    },
  });

  // Pick a rate. If a preferred service is specified, use it. Otherwise
  // pick the cheapest USPS rate available.
  let chosen: EasyPost.IRate | undefined;
  if (input.preferredService) {
    chosen = shipment.rates.find(r =>
      r.carrier === "USPS" && r.service === input.preferredService
    );
  }
  if (!chosen) {
    const usps = shipment.rates.filter(r => r.carrier === "USPS");
    chosen = [...usps].sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate))[0];
  }
  if (!chosen) {
    throw new Error(`EasyPost returned no USPS rates for this shipment. Rates: ${JSON.stringify(shipment.rates).slice(0, 300)}`);
  }

  const bought = await client.Shipment.buy(shipment.id, chosen);

  const labelUrl       = bought.postage_label?.label_url ?? "";
  const trackingNumber = bought.tracking_code           ?? "";
  if (!labelUrl || !trackingNumber) {
    throw new Error(`EasyPost label purchase succeeded but did not return URL or tracking. Got: ${JSON.stringify({ labelUrl, trackingNumber }).slice(0, 200)}`);
  }

  return {
    labelUrl,
    trackingNumber,
    carrier: bought.selected_rate?.carrier ?? "USPS",
    service: bought.selected_rate?.service ?? "Unknown",
    cost:    parseFloat(bought.selected_rate?.rate ?? "0"),
  };
}

/** Map EasyPost's carrier name to eBay's expected shipping carrier code. */
export function carrierCodeForEbay(easypostCarrier: string): string {
  // eBay's enumeration. Add more mappings as we expand carriers.
  const map: Record<string, string> = {
    USPS:   "USPS",
    UPS:    "UPS",
    FedEx:  "FedEx",
    DHLExpress: "DHL",
  };
  return map[easypostCarrier] ?? easypostCarrier;
}
