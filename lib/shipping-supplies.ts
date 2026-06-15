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
import { sendTransactionalEmail, lowSupplyAlertHtml } from "./transactional-email";

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
 *  packing slip total, not N of each.
 *
 *  After decrementing, any supply that JUST crossed its low-stock threshold
 *  (i.e., count was > threshold before, is now <= threshold) triggers an
 *  alert email to the configured admin address. Threshold crossings only —
 *  not every shipment-while-already-low — so the alert fires once per
 *  low-stock event. The next event fires again after the supply is restocked
 *  above threshold and drops back down. */
export async function decrementShippingSupplies(): Promise<void> {
  const crossed: SupplyState[] = [];

  for (const key of SUPPLIES) {
    const countKey = `supply_inventory_${key}`;
    const thresKey = `supply_inventory_${key}_threshold`;
    const [current, threshold] = await Promise.all([
      getSetting(countKey, 0),
      getSetting(thresKey, 10),
    ]);
    const next = Math.max(0, current - 1);
    if (next === current) continue; // already at 0

    await db.siteSetting.upsert({
      where:  { key: countKey },
      update: { value: String(next) },
      create: { key: countKey, value: String(next) },
    });

    // Crossed the threshold this decrement? Queue an alert.
    if (current > threshold && next <= threshold) {
      crossed.push({ key, label: SUPPLY_LABELS[key], count: next, threshold, isLow: true });
    }
  }

  if (crossed.length > 0) {
    await sendLowSupplyAlert(crossed);
  }
}

async function getAlertEmailAddress(): Promise<string> {
  const row = await db.siteSetting.findUnique({
    where: { key: "supply_alert_email" },
    select: { value: true },
  });
  // Fallback to Mike's hotmail per the explicit request that set this feature up.
  return row?.value?.trim() || "mikeahayward@hotmail.com";
}

async function sendLowSupplyAlert(supplies: SupplyState[]): Promise<void> {
  try {
    const to = await getAlertEmailAddress();
    const inventoryUrl =
      (process.env.NEXTAUTH_URL || "https://card-cloud-production.up.railway.app") +
      "/admin/settings#shipping-supplies";
    const subjectLabel = supplies.length === 1
      ? supplies[0].label.toLowerCase()
      : `${supplies.length} shipping supplies`;
    await sendTransactionalEmail({
      to,
      subject: `Low on ${subjectLabel} - Card Cloud supply alert`,
      html: lowSupplyAlertHtml({
        supplies: supplies.map(s => ({ label: s.label, count: s.count, threshold: s.threshold })),
        inventoryUrl,
      }),
    });
    console.log(`[supply-alert] sent to ${to} for ${supplies.map(s => s.key).join(", ")}`);
  } catch (e) {
    console.error("[supply-alert] failed:", e);
  }
}

/** Send a one-off test email to confirm the alert system is wired correctly.
 *  Posted from the operator's POV ("you set this up, here's proof it works")
 *  so the test arrives as a normal supply alert with one row showing dummy
 *  values. Not called by any automated path — only invoked manually. */
export async function sendSupplyAlertTestEmail(): Promise<{ ok: boolean; to: string }> {
  const to = await getAlertEmailAddress();
  const inventoryUrl =
    (process.env.NEXTAUTH_URL || "https://card-cloud-production.up.railway.app") +
    "/admin/settings#shipping-supplies";
  await sendTransactionalEmail({
    to,
    subject: "Test - Card Cloud supply alert system is live",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#042C53;padding:20px 24px">
          <p style="color:#fff;font-weight:bold;margin:0;font-size:18px">☁ The Card Cloud — Customer Service Agent</p>
        </div>
        <div style="padding:24px;background:#fff">
          <h2 style="color:#042C53;margin:0 0 8px">Supply alert system is live</h2>
          <p style="color:#334155;line-height:1.6">This is a test email to confirm the supply-tracking alert system is configured and reachable at <strong>${to}</strong>.</p>
          <p style="color:#334155;line-height:1.6">Going forward, whenever any of these supplies drops to or below the &ldquo;Alert at&rdquo; threshold you set in <a href="${inventoryUrl}" style="color:#042C53">Settings &rarr; Rates &rarr; Shipping supplies</a>, an alert email like this will fire automatically:</p>
          <ul style="color:#334155;line-height:1.8">
            <li>Envelopes</li>
            <li>Label sheets</li>
            <li>Packing slip sheets</li>
          </ul>
          <p style="color:#334155;line-height:1.6">Each alert fires <strong>once per low-stock event</strong> — after restocking above threshold, the next time supplies drop below it will fire again. No spam.</p>
          <p style="margin:24px 0 8px">
            <a href="${inventoryUrl}" style="background:#EF9F27;color:#412402;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Open inventory &rarr;</a>
          </p>
        </div>
        <div style="background:#042C53;padding:12px 24px">
          <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">&copy; 2026 The Card Cloud &middot; test alert</p>
        </div>
      </div>`,
  });
  return { ok: true, to };
}

export async function getLowSupplies(): Promise<SupplyState[]> {
  const all = await getSupplyInventory();
  return all.filter(s => s.isLow);
}
