import { db } from "./db";

export interface ShippingRates {
  envelopeCost:     number;  // eBay Standard Envelope — cards $20 and under
  envelopeMaxValue: number;  // price threshold: at or below this → use envelope
  bubbleMailerMin:  number;  // bubble mailer min cost — cards over threshold
  bubbleMailerMax:  number;  // bubble mailer max cost
}

const DEFAULTS: ShippingRates = {
  envelopeCost:     1.49,
  envelopeMaxValue: 20,
  bubbleMailerMin:  4.99,
  bubbleMailerMax:  5.99,
};

const KEYS = [
  "shipping_envelope_cost",
  "shipping_envelope_max_value",
  "shipping_bubble_mailer_min",
  "shipping_bubble_mailer_max",
] as const;

export async function getShippingRates(): Promise<ShippingRates> {
  try {
    const rows = await db.siteSetting.findMany({ where: { key: { in: [...KEYS] } } });
    const map  = new Map(rows.map(r => [r.key, r.value]));
    return {
      envelopeCost:     parseFloat(map.get("shipping_envelope_cost")      ?? String(DEFAULTS.envelopeCost)),
      envelopeMaxValue: parseFloat(map.get("shipping_envelope_max_value") ?? String(DEFAULTS.envelopeMaxValue)),
      bubbleMailerMin:  parseFloat(map.get("shipping_bubble_mailer_min")  ?? String(DEFAULTS.bubbleMailerMin)),
      bubbleMailerMax:  parseFloat(map.get("shipping_bubble_mailer_max")  ?? String(DEFAULTS.bubbleMailerMax)),
    };
  } catch {
    return DEFAULTS;
  }
}
