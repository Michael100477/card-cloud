// Server-only: imports db. Do NOT import from client components.
import { db } from "./db";
export { FIELD_CONFIGS, EBAY_LD_KEYS, EBAY_LD_FALLBACKS } from "./ebay-listing-defaults-shared";
export type { EbayListingDefaults, FieldConfig } from "./ebay-listing-defaults-shared";
import { FIELD_CONFIGS, EBAY_LD_FALLBACKS } from "./ebay-listing-defaults-shared";
import type { EbayListingDefaults } from "./ebay-listing-defaults-shared";

export async function getEbayListingDefaults(): Promise<EbayListingDefaults> {
  const keys = FIELD_CONFIGS.map(f => f.key);
  const rows = await db.siteSetting.findMany({ where: { key: { in: keys } } });
  const map  = new Map(rows.map(r => [r.key, r.value]));

  return Object.fromEntries(
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
}
