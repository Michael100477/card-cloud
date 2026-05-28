import { NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { getAccessToken, getEbayConnectionStatus } from "@/lib/ebay-auth";
import { db } from "@/lib/db";

async function getCred(service: string): Promise<string | null> {
  const row = await db.siteCredential.findUnique({ where: { service }, select: { value: true } });
  return row?.value || null;
}

export async function GET() {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const status = await getEbayConnectionStatus();
  if (!status.connected) {
    return NextResponse.json({ rules: [], source: "not_connected" });
  }

  let token: string;
  try { token = await getAccessToken(); }
  catch (e) { return NextResponse.json({ rules: [], source: "error", error: String(e) }); }

  const env = await getCred("ebay_environment");
  const base = env === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";

  // Try eBay's shipping discount profile endpoint
  const r = await fetch(`${base}/sell/account/v1/shipping_discount_profile`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });

  if (!r.ok) {
    // Endpoint may not be available for all seller accounts; return empty list gracefully
    return NextResponse.json({ rules: [], source: "none", status: r.status });
  }

  const data = await r.json();

  // Response shape: { shippingDiscountProfiles: [{ profileId, profileName, ... }] }
  const profiles: { id: string; name: string }[] = (
    data.shippingDiscountProfiles ?? []
  ).map((p: { profileId?: string; profileName?: string; name?: string }) => ({
    id:   p.profileId ?? "",
    name: p.profileName ?? p.name ?? p.profileId ?? "Unknown",
  })).filter((p: { id: string }) => p.id);

  return NextResponse.json({ rules: profiles, source: "ebay" });
}
