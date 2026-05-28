import { db } from "./db";

export interface CommissionRates {
  withPhotos:    number;   // % charged when seller provides photos
  withoutPhotos: number;   // % charged when we photograph
}

const DEFAULTS: CommissionRates = { withPhotos: 15, withoutPhotos: 20 };

export async function getCommissionRates(): Promise<CommissionRates> {
  try {
    const rows = await db.siteSetting.findMany({
      where: { key: { in: ["commission_with_photos", "commission_without_photos"] } },
    });
    const map = new Map(rows.map(r => [r.key, r.value]));
    return {
      withPhotos:    parseInt(map.get("commission_with_photos")    ?? String(DEFAULTS.withPhotos)),
      withoutPhotos: parseInt(map.get("commission_without_photos") ?? String(DEFAULTS.withoutPhotos)),
    };
  } catch {
    return DEFAULTS;
  }
}
