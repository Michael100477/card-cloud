import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/admin";
import { db } from "@/lib/db";
import { getAccessToken, getEbayConnectionStatus } from "@/lib/ebay-auth";

async function getCred(service: string): Promise<string | null> {
  const row = await db.siteCredential.findUnique({ where: { service }, select: { value: true } });
  return row?.value || null;
}

function ek(base: string, isSandbox: boolean): string {
  return isSandbox ? base : `${base}_prod`;
}

function attr(block: string, tag: string): string | null {
  return block.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`))?.[1]?.trim() ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const { itemId } = await params;

  const connStatus = await getEbayConnectionStatus();
  if (!connStatus.connected) return NextResponse.json({ error: "eBay not connected" }, { status: 400 });

  let token: string;
  try { token = await getAccessToken(); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }

  const isSandbox = connStatus.environment !== "production";
  const apiBase   = isSandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  const [appId, devId, certId] = await Promise.all([
    getCred(ek("ebay_app_id", isSandbox)),
    getCred("ebay_dev_id"),
    getCred(ek("ebay_cert_id", isSandbox)),
  ]);

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
  <IncludeItemSpecifics>true</IncludeItemSpecifics>
</GetItemRequest>`;

  const r = await fetch(`${apiBase}/ws/api.dll`, {
    method: "POST",
    headers: {
      "X-EBAY-API-CALL-NAME":           "GetItem",
      "X-EBAY-API-SITEID":              "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-APP-NAME":            appId  ?? "",
      "X-EBAY-API-DEV-NAME":            devId  ?? "",
      "X-EBAY-API-CERT-NAME":           certId ?? "",
      "Content-Type":                   "text/xml;charset=utf-8",
    },
    body: xml,
  });

  const text = await r.text();
  const ack  = text.match(/<Ack>(\w+)<\/Ack>/)?.[1];
  if (ack !== "Success" && ack !== "Warning") {
    const errMsg = text.match(/<LongMessage>([^<]+)<\/LongMessage>/)?.[1]
                ?? text.match(/<ShortMessage>([^<]+)<\/ShortMessage>/)?.[1]
                ?? "Unknown error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }

  // Extract item block
  const itemBlock = text.match(/<Item>([\s\S]*?)<\/Item>/)?.[1] ?? "";

  // Photos
  const photos = [...itemBlock.matchAll(/<PictureURL>([^<]+)<\/PictureURL>/g)]
    .map(m => m[1].trim())
    .filter(Boolean);

  // Item specifics — strip description CDATA first, then expand multi-value entries
  const blockForSpecifics = itemBlock.replace(/<Description>[\s\S]*?<\/Description>/g, "");
  const specifics: { name: string; value: string }[] = [];
  const nvLists = [...blockForSpecifics.matchAll(/<NameValueList>([\s\S]*?)<\/NameValueList>/g)];
  for (const nv of nvLists) {
    const name = attr(nv[1], "Name");
    if (!name) continue;
    const values = [...nv[1].matchAll(/<Value>([^<]+)<\/Value>/g)].map(m => m[1].trim()).filter(Boolean);
    for (const value of values) specifics.push({ name, value });
  }

  // Description — strip HTML tags
  const rawDesc = itemBlock.match(/<Description>([\s\S]*?)<\/Description>/)?.[1] ?? "";
  const description = rawDesc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return NextResponse.json({ photos, specifics, description });
}
