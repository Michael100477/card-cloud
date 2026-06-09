// Server-only: imports db. Do NOT import from client components.
import { db } from "./db";
export { FIELD_CONFIGS, EBAY_LD_KEYS, EBAY_LD_FALLBACKS } from "./ebay-listing-defaults-shared";
export type { EbayListingDefaults, FieldConfig } from "./ebay-listing-defaults-shared";
import { FIELD_CONFIGS, EBAY_LD_FALLBACKS } from "./ebay-listing-defaults-shared";
import type { EbayListingDefaults } from "./ebay-listing-defaults-shared";

export async function getEbayListingDefaults(): Promise<EbayListingDefaults> {
  const keys = FIELD_CONFIGS.map(f => f.key);
  // Settings → Rates → Shipping also contributes a couple of values to the
  // listing-form defaults (default shipping type + the flat-rate amount).
  const extraKeys = ["default_shipping_type", "shipping_bubble_mailer_min"];
  let map: Map<string, string>;
  try {
    const rows = await db.siteSetting.findMany({ where: { key: { in: [...keys, ...extraKeys] } } });
    map = new Map(rows.map(r => [r.key, r.value]));
  } catch {
    // Build-time prerender or DB temporarily unreachable — return defaults.
    map = new Map();
  }

  const fromFieldConfigs = Object.fromEntries(
    FIELD_CONFIGS.map(f => {
      const raw = map.get(f.key);
      let value: string | boolean | number = f.defaultValue;
      if (raw !== undefined) {
        if (f.type === "toggle") value = raw === "true";
        else if (f.type === "number-select") value = parseInt(raw) || (f.defaultValue as number);
        else value = raw;
      }
      return [f.draftField, value];
    })
  );

  // Apply the Settings → Rates → Shipping override: when defaultShippingType
  // is set, it takes precedence over the per-field shippingCostType /
  // freeShipping defaults. Also surface the bubbleMailerMin amount so the
  // editor can pre-fill the flat-rate field.
  const defaultShippingType = map.get("default_shipping_type") ?? "flat";
  const bubbleMailerMin     = parseFloat(map.get("shipping_bubble_mailer_min") ?? "5") || 5;

  if (defaultShippingType === "free") {
    fromFieldConfigs.freeShipping     = true;
    fromFieldConfigs.shippingCostType = "Flat rate: Same cost regardless of buyer location";
  } else if (defaultShippingType === "flat") {
    fromFieldConfigs.freeShipping     = false;
    fromFieldConfigs.shippingCostType = "Flat rate: Same cost regardless of buyer location";
  } else if (defaultShippingType === "calculated") {
    fromFieldConfigs.freeShipping     = false;
    fromFieldConfigs.shippingCostType = "Calculated: Cost varies based on buyer location";
  }

  fromFieldConfigs.defaultShippingType = defaultShippingType;
  fromFieldConfigs.bubbleMailerMin     = bubbleMailerMin;

  return fromFieldConfigs;
}
