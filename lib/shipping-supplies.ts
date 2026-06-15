// Shipping supply inventory tracking.
//
// Three supplies are tracked: envelope, label sheet, packing slip. Each
// shipment (single OR combined-order group) consumes ONE of each. We don't
// track tape here because tape is per-inch and rolls aren't discrete units.
//
// Settings keys:
//   supply_inventory_envelope               (int, current count)
//   supply_inventory_envelope_threshold     (int, low-stock alert trigger)
//   supply_inventory_label                  (int)
//   supply_inventory_label_threshold        (int)
//   supply_inventory_packing_slip           (int)
//   supply_inventory_packing_slip_threshold (int)

import { db } from "./db";

export const SUPPLIES = ["envelope", "label", "packing_slip"] as const;
export type SupplyKey = typeof SUPPLIES[number];

export const SUPPLY_LABELS: Record<SupplyKey, string> = {
  envelope:     "Envelopes",
  label:        "Label sheets",
  packing_slip: "Packing slip sheets",
};

interface SupplyState {
  key:       SupplyKey;
  label:     string;
  count:     number;
  threshold: number;
  isLow:     boolean;
}

async function getSetting(key: string, fallback: number): Promise<number> {
  const row = await db.siteSetting.findUnique({ where: { key }, select: { value: true } });
  const v = parseInt(row?.value ?? "");
  return Number.isFinite(v) ? v : fallback;
}

export async function getSupplyInventory(): Promise<SupplyState[]> {
  const results: SupplyState[] = [];
  for (const key of SUPPLIES) {
    const [count, threshold] = await Promise.all([
      getSetting(`supply_inventory_${key}`,             0),
      getSetting(`supply_inventory_${key}_threshold`,  10),
    ]);
    results.push({
      key,
      label:     SUPPLY_LABELS[key],
      count,
      threshold,
      isLow:     count <= threshold,
    });
  }
  return results;
}

/** Decrement each supply by 1 (clamped at 0). Called once per shipment —
 *  combined-order groups still consume one envelope + one label + one
 *  packing slip total, not N of each. Silent no-op if any supply hits 0;
 *  the user just keeps shipping and the low-stock banner stays visible. */
export async function decrementShippingSupplies(): Promise<void> {
  await Promise.all(SUPPLIES.map(async key => {
    const settingKey = `supply_inventory_${key}`;
    const current = await getSetting(settingKey, 0);
    const next    = Math.max(0, current - 1);
    if (next === current) return; // already at 0
    await db.siteSetting.upsert({
      where:  { key: settingKey },
      update: { value: String(next) },
      create: { key: settingKey, value: String(next) },
    });
  }));
}

export async function getLowSupplies(): Promise<SupplyState[]> {
  const all = await getSupplyInventory();
  return all.filter(s => s.isLow);
}
