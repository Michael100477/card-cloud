/**
 * eBay API client — handles photo upload to EPS, merchant setup,
 * inventory item creation, offer creation, and publishing.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { db } from "./db";
import { logger } from "./logger";
import { getAccessToken, getEbayConnectionStatus } from "./ebay-auth";
import { canonicalizeLeague, canonicalizeSport } from "./sports-data";

// ── Helpers ───────────────────────────────────────────────────────────────

async function getCred(service: string): Promise<string | null> {
  const row = await db.siteCredential.findUnique({ where: { service }, select: { value: true } });
  return row?.value || null;
}

async function setCred(service: string, label: string, value: string) {
  await db.siteCredential.upsert({
    where:  { service },
    update: { value },
    create: { service, label, value },
  });
}

// Returns the env-specific credential key — sandbox uses base key, production appends _prod
function ek(base: string, isSandbox: boolean): string {
  return isSandbox ? base : `${base}_prod`;
}

function apiBase(isSandbox: boolean) {
  return isSandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

async function ebayFetch(
  path: string,
  options: RequestInit,
  token: string,
  isSandbox: boolean,
): Promise<Response> {
  return fetch(`${apiBase(isSandbox)}${path}`, {
    ...options,
    headers: {
      Authorization:    `Bearer ${token}`,
      "Content-Type":   "application/json",
      "Content-Language": "en-US",
      "Accept-Language":  "en-US",
      ...(options.headers ?? {}),
    },
  });
}

// ── Photo upload to eBay Picture Services (EPS) ───────────────────────────

export async function uploadPhotoToEbay(
  photoUrl: string,
  accessToken: string,
  isSandbox: boolean,
): Promise<string | null> {
  let imageBuffer: Buffer;
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
    // Remote URL (R2 in production, custom domain, etc.) — fetch the bytes.
    try {
      const r = await fetch(photoUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      imageBuffer = Buffer.from(await r.arrayBuffer());
    } catch (err) {
      console.warn(`[ebay] photo fetch failed (${photoUrl}):`, err);
      logger.warn({ category: "ebay", action: "ebay.photo.fetch.failed", message: `Could not fetch remote photo ${photoUrl}: ${err}` });
      return null;
    }
  } else {
    // Local-relative URL like /uploads/abc.jpg — read from public/.
    const relative = photoUrl.startsWith("/") ? photoUrl.slice(1) : photoUrl;
    const filePath = join(process.env.PROJECT_ROOT ?? process.cwd(), "public", relative);
    try {
      imageBuffer = await readFile(filePath);
    } catch {
      console.warn(`[ebay] photo file not found: ${filePath}`);
      logger.warn({ category: "ebay", action: "ebay.photo.file.missing", message: `Photo file not found on disk: ${filePath}` });
      return null;
    }
  }

  const [appId, devId, certId] = await Promise.all([
    getCred(ek("ebay_app_id", isSandbox)), getCred("ebay_dev_id"), getCred(ek("ebay_cert_id", isSandbox)),
  ]);

  const xmlRequest = `<?xml version="1.0" encoding="utf-8"?><UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>${accessToken}</eBayAuthToken></RequesterCredentials><PictureName>card-photo</PictureName><PictureSet>Standard</PictureSet></UploadSiteHostedPicturesRequest>`;

  const boundary = `Boundary_${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="XML Payload"\r\nContent-Type: text/xml;charset=utf-8\r\n\r\n` +
      xmlRequest +
      `\r\n--${boundary}\r\nContent-Disposition: form-data; name="dummy"\r\nContent-Type: image/jpeg\r\nContent-Transfer-Encoding: binary\r\n\r\n`
    ),
    imageBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const base = isSandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  console.log(`[ebay] photo upload: ${photoUrl}`);
  const r = await fetch(`${base}/ws/api.dll`, {
    method: "POST",
    headers: {
      "X-EBAY-API-CALL-NAME":              "UploadSiteHostedPictures",
      "X-EBAY-API-SITEID":                 "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL":    "967",
      "X-EBAY-API-APP-NAME":               appId  ?? "",
      "X-EBAY-API-DEV-NAME":               devId  ?? "",
      "X-EBAY-API-CERT-NAME":              certId ?? "",
      "Content-Type":                      `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  const text = await r.text();
  const match = text.match(/<FullURL>(https?:\/\/[^<]+)<\/FullURL>/);
  if (!match) {
    console.warn(`[ebay] photo upload failed (${r.status}):`, text.slice(0, 300));
    logger.warn({ category: "ebay", action: "ebay.photo.upload.failed", message: `EPS upload failed for ${photoUrl}`, data: { status: r.status, response: text.slice(0, 500) } });
    return null;
  }
  console.log(`[ebay] photo uploaded → ${match[1]}`);
  return match[1];
}

// ── Merchant location ─────────────────────────────────────────────────────

const LOCATION_KEY = "card-cloud-hq";

async function ensureMerchantLocation(token: string, isSandbox: boolean): Promise<void> {
  const locKey = ek("ebay_merchant_location_key", isSandbox);
  const stored = await getCred(locKey);
  if (stored === LOCATION_KEY) {
    console.log(`[ebay] merchant location already set: ${LOCATION_KEY}`);
    return;
  }

  console.log(`[ebay] merchant location: creating ${LOCATION_KEY}…`);
  const r = await ebayFetch(`/sell/inventory/v1/location/${LOCATION_KEY}`, {
    method: "POST",
    body: JSON.stringify({
      location: {
        address: {
          addressLine1: "69 Nagy Rd",
          city:         "Ashford",
          stateOrProvince: "CT",
          postalCode:   "06278",
          country:      "US",
        },
      },
      locationInstructions: "Ship within 3 business days.",
      name:                 "The Card Cloud HQ",
      merchantLocationStatus: "ENABLED",
      locationTypes:        ["WAREHOUSE"],
    }),
  }, token, isSandbox);

  if (r.ok || r.status === 409) {
    console.log(`[ebay] merchant location ready (status: ${r.status})`);
    await setCred(locKey, "eBay Merchant Location Key", LOCATION_KEY);
  } else {
    const err = await r.json().catch(() => ({}));
    logger.error({ category: "ebay", action: "ebay.location.create.failed", message: `Failed to create merchant location`, data: { status: r.status, err } });
    throw new Error(`Failed to create merchant location (${r.status}): ${JSON.stringify(err)}`);
  }
}

// ── Account policies (fulfillment, payment, return) ───────────────────────

async function getOrCreateFulfillmentPolicy(
  name: string, body: object, cacheKey: string, cacheLabel: string,
  token: string, isSandbox: boolean
): Promise<string> {
  const listR = await ebayFetch(
    "/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US&limit=100",
    { method: "GET" }, token, isSandbox
  );
  console.log(`[ebay] fulfillment policy "${name}": list status ${listR.status}`);
  if (listR.ok) {
    const d = await listR.json();
    const policies = d.fulfillmentPolicies ?? [];
    console.log(`[ebay] fulfillment policies found: ${policies.map((p: { name: string; fulfillmentPolicyId: string }) => `${p.name}=${p.fulfillmentPolicyId}`).join(", ")}`);
    const existing = policies.find((p: { name: string; fulfillmentPolicyId: string }) => p.name === name);
    if (existing?.fulfillmentPolicyId) {
      console.log(`[ebay] fulfillment policy "${name}": using existing ${existing.fulfillmentPolicyId}`);
      await setCred(cacheKey, cacheLabel, existing.fulfillmentPolicyId);
      return existing.fulfillmentPolicyId;
    }
  } else {
    const errText = await listR.text().catch(() => "");
    console.warn(`[ebay] fulfillment policy list failed (${listR.status}):`, errText.slice(0, 300));
    logger.warn({ category: "ebay", action: "ebay.policy.fulfillment.list.failed", message: `Could not list fulfillment policies`, data: { status: listR.status, response: errText.slice(0, 500) } });
  }

  console.log(`[ebay] fulfillment policy "${name}": creating…`);
  const r = await ebayFetch("/sell/account/v1/fulfillment_policy", { method: "POST", body: JSON.stringify(body) }, token, isSandbox);
  const d = await r.json();
  console.log(`[ebay] fulfillment policy "${name}": create status ${r.status}`, JSON.stringify(d).slice(0, 300));

  if (d.fulfillmentPolicyId) {
    console.log(`[ebay] fulfillment policy "${name}": created ${d.fulfillmentPolicyId}`);
    await setCred(cacheKey, cacheLabel, d.fulfillmentPolicyId);
    return d.fulfillmentPolicyId;
  }

  const dupParam = (d.errors?.[0]?.parameters ?? []).find(
    (p: { name: string; value: string }) => p.name === "Shipping Profile Id"
  );
  if (dupParam?.value) {
    console.log(`[ebay] fulfillment policy "${name}": already exists with id ${dupParam.value}`);
    await setCred(cacheKey, cacheLabel, dupParam.value);
    return dupParam.value;
  }

  logger.warn({ category: "ebay", action: "ebay.policy.fulfillment.create.failed", message: `Could not create or find fulfillment policy "${name}"`, data: { status: r.status, response: d } });
  return "";
}

async function getOrCreatePaymentPolicy(token: string, isSandbox: boolean): Promise<string> {
  const pKey = ek("ebay_payment_policy_id", isSandbox);
  const paymentBody = {
    name: "eBay Managed Payments", marketplaceId: "EBAY_US",
    categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
  };

  console.log(`[ebay] payment policy: listing…`);
  const listR = await ebayFetch(
    "/sell/account/v1/payment_policy?marketplace_id=EBAY_US&limit=100",
    { method: "GET" }, token, isSandbox
  );
  console.log(`[ebay] payment policy: list status ${listR.status}`);

  if (listR.ok) {
    const d = await listR.json();
    const existing = (d.paymentPolicies ?? []).find((p: { name: string; paymentPolicyId: string }) => p.name === "eBay Managed Payments");
    if (existing?.paymentPolicyId) {
      console.log(`[ebay] payment policy: found ${existing.paymentPolicyId}, updating to remove immediatePay`);
      const updateR = await ebayFetch(`/sell/account/v1/payment_policy/${existing.paymentPolicyId}`, {
        method: "PUT", body: JSON.stringify(paymentBody),
      }, token, isSandbox);
      const updateBody = await updateR.json().catch(() => ({}));
      console.log(`[ebay] payment policy: update status ${updateR.status}`, updateR.ok ? "ok" : JSON.stringify(updateBody).slice(0, 200));
      if (!updateR.ok) {
        logger.warn({ category: "ebay", action: "ebay.policy.payment.update.failed", message: `Could not update payment policy ${existing.paymentPolicyId}`, data: { status: updateR.status, response: updateBody } });
      }
      await setCred(pKey, "eBay Payment Policy ID", existing.paymentPolicyId);
      return existing.paymentPolicyId;
    }
  } else {
    const errText = await listR.text().catch(() => "");
    console.warn(`[ebay] payment policy list failed (${listR.status}):`, errText.slice(0, 200));
    logger.warn({ category: "ebay", action: "ebay.policy.payment.list.failed", message: `Could not list payment policies`, data: { status: listR.status, response: errText.slice(0, 500) } });
  }

  console.log(`[ebay] payment policy: creating…`);
  const r = await ebayFetch("/sell/account/v1/payment_policy", {
    method: "POST", body: JSON.stringify(paymentBody),
  }, token, isSandbox);
  const d = await r.json();
  console.log(`[ebay] payment policy: create status ${r.status}`, JSON.stringify(d).slice(0, 200));

  if (d.paymentPolicyId) {
    console.log(`[ebay] payment policy: created ${d.paymentPolicyId}`);
    await setCred(pKey, "eBay Payment Policy ID", d.paymentPolicyId);
    return d.paymentPolicyId;
  }
  const dup = (d.errors?.[0]?.parameters ?? []).find((p: { name: string; value: string }) => p.name?.toLowerCase().includes("id"));
  if (dup?.value) {
    console.log(`[ebay] payment policy: already exists ${dup.value}`);
    await setCred(pKey, "eBay Payment Policy ID", dup.value);
    return dup.value;
  }

  logger.warn({ category: "ebay", action: "ebay.policy.payment.create.failed", message: `Could not create or find payment policy`, data: { status: r.status, response: d } });
  return "";
}

async function getOrCreateReturnPolicy(token: string, isSandbox: boolean): Promise<string> {
  const rKey = ek("ebay_return_policy_id", isSandbox);

  console.log(`[ebay] return policy: listing…`);
  const listR = await ebayFetch(
    "/sell/account/v1/return_policy?marketplace_id=EBAY_US&limit=100",
    { method: "GET" }, token, isSandbox
  );
  console.log(`[ebay] return policy: list status ${listR.status}`);

  if (listR.ok) {
    const d = await listR.json();
    const existing = (d.returnPolicies ?? []).find((p: { name: string; returnPolicyId: string }) => p.name === "30 Day Returns");
    if (existing?.returnPolicyId) {
      console.log(`[ebay] return policy: using existing ${existing.returnPolicyId}`);
      await setCred(rKey, "eBay Return Policy ID", existing.returnPolicyId);
      return existing.returnPolicyId;
    }
  } else {
    const errText = await listR.text().catch(() => "");
    console.warn(`[ebay] return policy list failed (${listR.status}):`, errText.slice(0, 200));
    logger.warn({ category: "ebay", action: "ebay.policy.return.list.failed", message: `Could not list return policies`, data: { status: listR.status, response: errText.slice(0, 500) } });
  }

  console.log(`[ebay] return policy: creating…`);
  const r = await ebayFetch("/sell/account/v1/return_policy", {
    method: "POST",
    body: JSON.stringify({
      name: "30 Day Returns", marketplaceId: "EBAY_US",
      categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
      returnsAccepted: true,
      returnPeriod: { value: 30, unit: "DAY" },
      returnMethod: "REPLACEMENT",
      returnShippingCostPayer: "SELLER",
      description: "Returns accepted within 30 days.",
    }),
  }, token, isSandbox);
  const d = await r.json();
  console.log(`[ebay] return policy: create status ${r.status}`, JSON.stringify(d).slice(0, 200));

  if (d.returnPolicyId) {
    console.log(`[ebay] return policy: created ${d.returnPolicyId}`);
    await setCred(rKey, "eBay Return Policy ID", d.returnPolicyId);
    return d.returnPolicyId;
  }
  const dup = (d.errors?.[0]?.parameters ?? []).find((p: { name: string; value: string }) => p.name?.toLowerCase().includes("id"));
  if (dup?.value) {
    console.log(`[ebay] return policy: already exists ${dup.value}`);
    await setCred(rKey, "eBay Return Policy ID", dup.value);
    return dup.value;
  }

  logger.warn({ category: "ebay", action: "ebay.policy.return.create.failed", message: `Could not create or find return policy`, data: { status: r.status, response: d } });
  return "";
}

async function ensurePolicies(token: string, isSandbox: boolean): Promise<{
  fulfillmentPolicyId: string;
  freeShippingPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
}> {
  const marketplace = "EBAY_US";
  const stdShippingBody = {
    name: "Standard Shipping", description: "Ships within 3 business days",
    marketplaceId: marketplace, categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
    handlingTime: { value: 3, unit: "DAY" },
    shippingOptions: [{ costType: "FLAT_RATE", optionType: "DOMESTIC", shippingServices: [{
      buyerResponsibleForShipping: false, shippingCarrierCode: "USPS",
      shippingServiceCode: "USPSFirstClass", shippingCost: { value: "4.99", currency: "USD" },
    }]}],
  };
  const freeShippingBody = {
    name: "Free Shipping", description: "Free shipping — cost built into price",
    marketplaceId: marketplace, categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
    handlingTime: { value: 3, unit: "DAY" },
    shippingOptions: [{ costType: "FLAT_RATE", optionType: "DOMESTIC", shippingServices: [{
      buyerResponsibleForShipping: false, freeShipping: true,
      shippingCarrierCode: "USPS", shippingServiceCode: "USPSFirstClass",
      shippingCost: { value: "0.00", currency: "USD" },
    }]}],
  };

  // Must opt in before any policy CRUD — idempotent, safe to call every time
  console.log(`[ebay] optInToProgram: SELLING_POLICY_MANAGEMENT…`);
  const optR = await ebayFetch("/sell/account/v1/program/opt_in", {
    method: "POST",
    body: JSON.stringify({ programType: "SELLING_POLICY_MANAGEMENT" }),
  }, token, isSandbox);
  if (optR.status === 200) {
    console.log(`[ebay] optInToProgram: opted in successfully`);
  } else if (optR.status === 409) {
    console.log(`[ebay] optInToProgram: already opted in (ok)`);
  } else {
    const optErr = await optR.json().catch(() => ({}));
    console.warn(`[ebay] optInToProgram: unexpected status ${optR.status}`, JSON.stringify(optErr).slice(0, 200));
    logger.warn({ category: "ebay", action: "ebay.program.optIn.failed", message: `optInToProgram returned ${optR.status}`, data: { status: optR.status, response: optErr } });
  }

  const [fulfillmentPolicyId, freeShippingPolicyId, paymentPolicyId, returnPolicyId] = await Promise.all([
    getOrCreateFulfillmentPolicy("Standard Shipping", stdShippingBody, ek("ebay_fulfillment_policy_id",    isSandbox), "eBay Fulfillment Policy ID",   token, isSandbox),
    getOrCreateFulfillmentPolicy("Free Shipping",     freeShippingBody, ek("ebay_free_shipping_policy_id", isSandbox), "eBay Free Shipping Policy ID", token, isSandbox),
    getOrCreatePaymentPolicy(token, isSandbox),
    getOrCreateReturnPolicy(token, isSandbox),
  ]);

  console.log("[ebay] policies resolved:", { fulfillmentPolicyId, freeShippingPolicyId, paymentPolicyId, returnPolicyId });

  return { fulfillmentPolicyId, freeShippingPolicyId, paymentPolicyId, returnPolicyId };
}

// ── Condition and category helpers ────────────────────────────────────────

function ebayCondition(
  condition: string | null,
  graded: boolean,
  conditionType?: string | null,
  cardCondition?: string | null,
  isLot?: boolean,
): string {
  // eBay's Trading Card Singles category (261328) only accepts two conditions:
  //   Graded   → LIKE_NEW        (numeric 2750)
  //   Ungraded → USED_VERY_GOOD  (numeric 4000)
  // Trading Card Lots category (183444) uses simpler condition IDs:
  //   New      → NEW             (numeric 1000)
  //   Used     → USED_GOOD       (numeric 5000)
  // Inventory API enum → numeric code mappings: NEW=1000, LIKE_NEW=2750,
  // USED_EXCELLENT=3000, USED_VERY_GOOD=4000, USED_GOOD=5000, USED_ACCEPTABLE=6000.
  void condition;
  if (graded || conditionType === "graded") return "LIKE_NEW";
  if (isLot) {
    return cardCondition?.trim().toLowerCase() === "new" ? "NEW" : "USED_GOOD";
  }
  return "USED_VERY_GOOD";
}

// Map between eBay's conditionId numbers and the enum strings the inventory
// item API accepts. Used for dynamic condition lookup on lot categories
// whose accepted conditionIds vary.
const CONDITION_ID_TO_ENUM: Record<string, string> = {
  "1000": "NEW",
  "1500": "NEW_OTHER",
  "1750": "NEW_WITH_DEFECTS",
  "2000": "MANUFACTURER_REFURBISHED",
  "2500": "SELLER_REFURBISHED",
  "2750": "LIKE_NEW",
  "3000": "USED_EXCELLENT",
  "4000": "USED_VERY_GOOD",
  "5000": "USED_GOOD",
  "6000": "USED_ACCEPTABLE",
  "7000": "FOR_PARTS_OR_NOT_WORKING",
};

/** Fetch the allowed conditionIds for a category and return the eBay
 *  inventory-API enum string that best matches the seller's intent.
 *  Used for lot categories whose accepted conditionIds differ from
 *  Trading Card Singles. Falls back to USED_EXCELLENT / NEW if the
 *  metadata fetch fails. */
async function resolveLotConditionEnum(
  categoryId: string,
  cardCondition: string,
  token: string,
  sandbox: boolean,
): Promise<string> {
  const wantNew = cardCondition.trim().toLowerCase() === "new";
  try {
    const policyR = await ebayFetch(
      `/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=categoryIds:%7B${categoryId}%7D`,
      { method: "GET" }, token, sandbox,
    );
    const policyData = await policyR.json().catch(() => ({}));
    type ItemCondition = { conditionId?: string };
    const allConditions: ItemCondition[] = policyData?.itemConditionPolicies?.[0]?.itemConditions ?? [];
    const availableIds = allConditions.map(c => c.conditionId).filter((x): x is string => !!x);
    console.log(`[ebay] resolveLotConditionEnum: category=${categoryId} availableIds=${JSON.stringify(availableIds)} wantNew=${wantNew}`);
    if (wantNew) {
      for (const id of ["1000", "1500", "1750"]) {
        if (availableIds.includes(id)) return CONDITION_ID_TO_ENUM[id];
      }
    } else {
      for (const id of ["3000", "4000", "5000", "6000"]) {
        if (availableIds.includes(id)) return CONDITION_ID_TO_ENUM[id];
      }
    }
    // Last resort: return whatever's first in the list
    if (availableIds[0] && CONDITION_ID_TO_ENUM[availableIds[0]]) {
      return CONDITION_ID_TO_ENUM[availableIds[0]];
    }
  } catch (e) {
    console.warn(`[ebay] resolveLotConditionEnum failed:`, e);
  }
  return wantNew ? "NEW" : "USED_EXCELLENT";
}

// Look up eBay's required conditionDescriptors for the given category + condition.
// Required by category 261328 (Trading Card Singles). Returns [] if the category
// doesn't require descriptors (eBay tolerates missing field then).
async function resolveConditionDescriptors(
  input: { categoryId?: string | null; sport?: string | null; graded?: boolean; conditionType?: string | null; cardCondition?: string | null; gradeCompany?: string | null; gradeCompanyEbay?: string | null; isLot?: boolean },
  token: string,
  sandbox: boolean,
): Promise<{ name: string; values: string[] }[]> {
  const categoryId = input.categoryId || ebayCategory(input.sport ?? null);
  const policyR = await ebayFetch(
    `/sell/metadata/v1/marketplace/EBAY_US/get_item_condition_policies?filter=categoryIds:%7B${categoryId}%7D`,
    { method: "GET" }, token, sandbox,
  );
  const policyData = await policyR.json().catch(() => ({}));

  type DescriptorValue = { conditionDescriptorValueId?: string; conditionDescriptorValueName?: string };
  type DescriptorConstraint = { usage?: string; defaultConditionDescriptorValueId?: string };
  type Descriptor = { conditionDescriptorId?: string; conditionDescriptorConstraint?: DescriptorConstraint; conditionDescriptorValues?: DescriptorValue[] };
  type ItemCondition = { conditionId?: string; conditionDescriptors?: Descriptor[] };

  const isGraded = input.graded || input.conditionType === "graded";
  const isLot    = input.isLot === true;
  const cardCondLower = (input.cardCondition ?? "").trim().toLowerCase();

  // Pick the right inventory conditionId based on listing mode:
  //   Graded single → 2750 (LIKE_NEW)
  //   Lot, "New"    → 1000 (NEW)
  //   Lot, "Used"   → 5000 (USED_GOOD)
  //   Ungraded sin. → 4000 (USED_VERY_GOOD)
  let targetConditionId: string;
  if (isGraded) targetConditionId = "2750";
  else if (isLot) targetConditionId = cardCondLower === "new" ? "1000" : "5000";
  else targetConditionId = "4000";

  const allConditions: ItemCondition[] = policyData?.itemConditionPolicies?.[0]?.itemConditions ?? [];
  // Try the exact target conditionId first. If the category doesn't have
  // descriptors there (some lot categories), fall back to any itemCondition
  // that has a 40001 descriptor — the value catalog is the same across
  // condition IDs for a given category.
  let itemCondition = allConditions.find(c => c.conditionId === targetConditionId);
  if (!itemCondition || !itemCondition.conditionDescriptors?.length) {
    itemCondition = allConditions.find(c =>
      c.conditionDescriptors?.some(d => d.conditionDescriptorId === "40001")
    );
  }
  const descriptors = itemCondition?.conditionDescriptors ?? [];

  const result: { name: string; values: string[] }[] = [];
  for (const d of descriptors) {
    if (d.conditionDescriptorConstraint?.usage !== "REQUIRED") continue;
    const dId = d.conditionDescriptorId;
    if (!dId) continue;

    let valueId: string | undefined;
    if (dId === "40001") {
      if (isLot) {
        // Lot values are simple: New / Used. Match exactly (case-insensitive),
        // not by prefix, so "Used" doesn't accidentally hit "Used (heavy wear)".
        const want = cardCondLower || "used";
        valueId = d.conditionDescriptorValues?.find(v =>
          (v.conditionDescriptorValueName ?? "").toLowerCase() === want
        )?.conditionDescriptorValueId;
      } else {
        const wantPrefix = (input.cardCondition ?? "Excellent").trim().toLowerCase().split(" ")[0];
        valueId = d.conditionDescriptorValues?.find(v =>
          (v.conditionDescriptorValueName ?? "").toLowerCase().startsWith(wantPrefix)
        )?.conditionDescriptorValueId;
      }
    } else if (dId === "27501") {
      const wantGrader = (input.gradeCompanyEbay ?? input.gradeCompany ?? "").trim().toLowerCase();
      if (wantGrader) {
        valueId = d.conditionDescriptorValues?.find(v =>
          (v.conditionDescriptorValueName ?? "").toLowerCase().includes(wantGrader)
        )?.conditionDescriptorValueId;
      }
    }
    valueId = valueId ?? d.conditionDescriptorConstraint?.defaultConditionDescriptorValueId;
    if (valueId) result.push({ name: dId, values: [valueId] });
  }
  console.log("[ebay] resolveConditionDescriptors:", isGraded ? "Graded" : isLot ? `Lot/${input.cardCondition}` : "Ungraded", "→", JSON.stringify(result));
  return result;
}

function toHtmlDescription(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(para => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function ebayCategory(sport: string | null): string {
  const map: Record<string, string> = {
    "Baseball":              "261328",
    "Football":              "261328",
    "Basketball":            "261328",
    "Hockey":                "261328",
    "Soccer":                "261328",
    "Golf":                  "261328",
    "Tennis":                "261328",
    "Boxing":                "261328",
    "MMA":                   "261328",
    "Wrestling":             "261328",
    "Pokémon":               "183050",
    "Magic: The Gathering":  "2536",
    "Yu-Gi-Oh!":             "183050",
  };
  return map[sport ?? ""] ?? "261328";
}

// ── Main: create and publish a listing ────────────────────────────────────

export interface EbayListingInput {
  listingDbId:   string;
  title:         string;
  subtitle?:     string | null;
  description:   string;
  startPrice:    number;
  buyItNowPrice: number | null;
  freeShipping:  boolean;
  allowOffers:   boolean;
  minimumOffer:   number | null;
  autoAcceptOffer: number | null;
  condition:     string | null;
  cardName:      string | null;
  cardType:      string | null;
  cardSize:      string | null;
  countryOfOrigin: string | null;
  features:      string[];
  signedBy:               string | null;
  autographAuthentication: string | null;
  autographFormat:         string | null;
  sku:           string;
  photos:        string[];
  sport:         string | null;
  player:        string;
  year:          number | null;
  manufacturer:  string | null;
  set:           string | null;
  subset:        string | null;
  cardNumber:    string | null;
  team:          string | null;
  league:        string | null;
  season:        string | null;
  parallel:      string | null;
  graded:        boolean;
  grade:         string | null;
  gradeCompany:  string | null;
  certNumber:    string | null;
  serialNumber:  string | null;
  autographed:         boolean;
  listingType:         string | null;
  auctionDuration?:    number | null;
  categoryId?:         string | null;
  conditionType?:      string | null;
  gradeCompanyEbay?:   string | null;
  gradeEbay?:          string | null;
  certNumberEbay?:     string | null;
  cardCondition?:      string | null;
  autographAuthNumber?: string | null;
  vintage?:             boolean;
  eventTournament?:     string | null;
  language?:            string | null;
  originalOrLicensed?:  string | null;
  californiaProp65?:    string | null;
  cardThickness?:       string | null;
  material?:            string | null;
  reservePrice?:        number | null;
  scheduledTime?:       string | null;
  privateListing?:      boolean;
  shippingMethod?:      string | null;
  shippingCostType?:        string | null;
  flatRateShipping?:        number | null;
  excludedLocations?:       string[];
  combinedShippingRule?:    string | null;
  weightLbs?:           number | null;
  weightOz?:            number | null;
  dimLength?:           number | null;
  dimWidth?:            number | null;
  dimHeight?:           number | null;
  customized?:          boolean;
  insertSet?:           string | null;
  printRun?:            string | null;
  customSpecifics?:     { name: string; value: string }[] | null;
  // Card-lot mode — Trading Card Lots (eBay category 183444) requires
  // a "Number of Cards" item specific. When isLot is true and cardCount
  // is set, we emit it as part of the aspects payload.
  isLot?:               boolean;
  cardCount?:           number | null;
  existingEbayListingId?: string | null;
}

function buildAspects(input: EbayListingInput): Record<string, string[]> {
  const aspects: Record<string, string[]> = {};
  if (input.player)       aspects["Player/Athlete"]    = [input.player];
  if (input.cardName)     aspects["Card Name"]         = [input.cardName];
  if (input.cardNumber)   aspects["Card Number"]       = [input.cardNumber];
  if (input.manufacturer) aspects["Manufacturer"]      = [input.manufacturer];
  if (input.set)          aspects["Set"]               = [input.set];
  if (input.parallel || input.subset) aspects["Parallel/Variety"] = [input.parallel ?? input.subset ?? ""];
  if (input.year)         aspects["Year Manufactured"] = [String(input.year)];
  if (input.season)       aspects["Season"]            = [input.season];
  aspects["Type"] = [input.cardType ?? "Sports Trading Card"];
  // Trading Card Lots category (183444) requires Number of Cards.
  if (input.isLot && input.cardCount && input.cardCount > 0) {
    aspects["Number of Cards"] = [String(input.cardCount)];
  }
  if (input.cardSize) aspects["Card Size"] = [input.cardSize];

  // "Card Condition" (item specific 40001) is required by category 261328.
  // eBay's exact accepted values for ungraded: "Near Mint or Better", "Excellent",
  // "Very Good", "Poor" (note title-case "Mint", "Better", "Good"). Our form stores
  // them in mixed case ("Near mint or better", "Very good") so we normalize here.
  const normalizeCardCondition = (raw: string): string => {
    const map: Record<string, string> = {
      "near mint or better": "Near Mint or Better",
      "excellent":           "Excellent",
      "very good":           "Very Good",
      "poor":                "Poor",
      // Lot listings (Trading Card Lots category) use simpler values:
      "new":                 "New",
      "used":                "Used",
    };
    return map[raw.trim().toLowerCase()] ?? raw;
  };
  if (input.isLot) {
    // Trading Card Lots (category 261329) does NOT use the "Card Condition"
    // item specific that singles have. Instead the condition lives entirely
    // on the inventory item's top-level condition enum (NEW / USED_*),
    // resolved dynamically by resolveLotConditionEnum(). Sending a "Card
    // Condition" aspect here would either be ignored or rejected as an
    // invalid aspect for the category, so we omit it entirely for lots.
  } else if (!(input.graded || input.conditionType === "graded")) {
    // For ungraded single cards, Card Condition is the required SELECTION_ONLY
    // aspect. Graded singles don't use Card Condition — they're identified
    // via the Professional Grader conditionDescriptor instead, so omit this
    // aspect entirely for graded singles.
    const cc = input.cardCondition?.trim();
    aspects["Card Condition"] = [cc ? normalizeCardCondition(cc) : "Excellent"];
  }

  const effectiveGraded  = input.conditionType === "graded" || (input.conditionType == null && input.graded);
  const effectiveGrade   = input.gradeEbay       || input.grade       || "";
  const effectiveGrader  = input.gradeCompanyEbay || input.gradeCompany || "";
  const effectiveCert    = input.certNumberEbay   || input.certNumber   || "";
  if (effectiveGraded) {
    if (effectiveGrade)  aspects["Grade"]                  = [effectiveGrade];
    if (effectiveGrader) aspects["Professional Grader"]    = [effectiveGrader];
    if (effectiveCert)   aspects["Certification Number"]   = [effectiveCert];
  }

  // `||` (not `??`) so empty strings from the form fall through to the
  // default — eBay rejects empty aspect values with a 400.
  aspects["Card Thickness"]               = [input.cardThickness     || "35 pt."];
  if (input.material) aspects["Material"] = [input.material];
  aspects["Country/Region of Manufacture"]  = [input.countryOfOrigin || "United States"];
  aspects["Language"]                       = [input.language         || "English"];
  aspects["Vintage"]                        = [input.vintage ? "Yes" : "No"];
  aspects["Original/Licensed Reprint"]      = [input.originalOrLicensed || "Original"];
  aspects["Customized"]                     = [input.customized ? "Yes" : "No"];
  // Run stored values through canonicalize* in case they're old short-form data
  // (e.g. "NFL" from before the dropdown labels were changed to the long form).
  if (input.sport)  aspects["Sport"]  = [canonicalizeSport(input.sport)];
  if (input.team)   aspects["Team"]   = [input.team];
  if (input.league) aspects["League"] = [canonicalizeLeague(input.league)];

  aspects["Autographed"] = [input.autographed ? "Yes" : "No"];
  if (input.autographed) {
    if (input.signedBy)               aspects["Signed By"]                      = [input.signedBy];
    if (input.autographAuthentication) aspects["Autograph Authentication"]       = [input.autographAuthentication];
    if (input.autographAuthNumber)    aspects["Autograph Authentication Number"] = [input.autographAuthNumber];
    if (input.autographFormat)        aspects["Autograph Format"]               = [input.autographFormat];
  }
  if (input.features.length)  aspects["Features"]              = input.features;
  if (input.insertSet)        aspects["Insert Set"]             = [input.insertSet];
  if (input.printRun)         aspects["Print Run"]              = [input.printRun];
  if (input.eventTournament)  aspects["Event/Tournament"]       = [input.eventTournament];
  if (input.californiaProp65) aspects["California Prop 65 Warning"] = [input.californiaProp65];
  if (input.customSpecifics) {
    for (const { name, value } of input.customSpecifics) {
      if (name.trim() && value.trim()) aspects[name.trim()] = [value.trim()];
    }
  }
  return aspects;
}

function buildOfferBody(input: EbayListingInput, isAuction: boolean, policies: {
  fulfillmentPolicyId: string; freeShippingPolicyId: string;
  paymentPolicyId: string; returnPolicyId: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    sku:             input.sku,
    marketplaceId:   "EBAY_US",
    format:          isAuction ? "AUCTION" : "FIXED_PRICE",
    listingDuration: isAuction ? `DAYS_${input.auctionDuration ?? 7}` : "GTC",
    ...(input.subtitle ? { subtitle: input.subtitle } : {}),
    ...(isAuction ? {} : { availableQuantity: 1 }),
    categoryId:          input.categoryId || ebayCategory(input.sport),
    listingDescription:  toHtmlDescription(input.description),
    merchantLocationKey: LOCATION_KEY,
    ...buildListingPolicies(input.freeShipping, isAuction, policies),
    pricingSummary: isAuction
      ? {
          auctionStartPrice: { value: String(input.startPrice), currency: "USD" },
          ...(input.buyItNowPrice ? { auctionBuyItNowPrice: { value: String(input.buyItNowPrice), currency: "USD" } } : {}),
        }
      : { price: { value: String(input.buyItNowPrice ?? input.startPrice), currency: "USD" } },
  };
  if (!isAuction && input.buyItNowPrice && input.allowOffers) {
    body.bestOfferTerms = {
      bestOfferEnabled: true,
      ...(input.minimumOffer    ? { minimumBestOfferPrice:    { value: String(input.minimumOffer),    currency: "USD" } } : {}),
      ...(input.autoAcceptOffer ? { bestOfferAutoAcceptPrice: { value: String(input.autoAcceptOffer), currency: "USD" } } : {}),
    };
  }
  if (input.excludedLocations?.length) {
    body.shipToLocations = { regionExcluded: input.excludedLocations.map(loc => ({ regionName: loc, regionType: "DOMESTIC_REGION" })) };
  }
  if (input.shippingCostType?.startsWith("Flat rate") && input.flatRateShipping != null) {
    body.shippingCostOverrides = [{ shippingCost: { value: String(input.flatRateShipping), currency: "USD" }, shippingServiceType: "DOMESTIC", priority: 1 }];
  }
  if (input.scheduledTime)  body.listingStartDate    = new Date(input.scheduledTime).toISOString();
  if (input.privateListing) body.privateListing      = true;
  if (input.shippingMethod === "Local pickup only: Sell to buyers near you") body.pickupDropOffEnabled = true;
  if (isAuction && input.reservePrice) {
    (body.pricingSummary as Record<string, unknown>).auctionReservePrice = { value: String(input.reservePrice), currency: "USD" };
  }
  return body;
}

function buildListingPolicies(freeShipping: boolean, isAuction: boolean, policies: {
  fulfillmentPolicyId: string; freeShippingPolicyId: string;
  paymentPolicyId: string; returnPolicyId: string;
}): Record<string, unknown> {
  const fulfillId = freeShipping
    ? (policies.freeShippingPolicyId || policies.fulfillmentPolicyId)
    : (policies.fulfillmentPolicyId  || policies.freeShippingPolicyId);

  if (!fulfillId) {
    console.warn("[ebay] no valid fulfillmentPolicyId — omitting listingPolicies, eBay will use account defaults");
    logger.warn({ category: "ebay", action: "ebay.policy.fulfillment.missing", message: "No fulfillmentPolicyId available — listing will use account defaults" });
    return {};
  }

  return {
    listingPolicies: {
      fulfillmentPolicyId: fulfillId,
      // Payment policy is omitted for auctions — Managed Payments enforces immediatePay which
      // conflicts with pure auctions. eBay collects payment automatically after auction close.
      ...(!isAuction && policies.paymentPolicyId ? { paymentPolicyId: policies.paymentPolicyId } : {}),
      ...(policies.returnPolicyId  ? { returnPolicyId:  policies.returnPolicyId  } : {}),
    },
  };
}

export async function createEbayListing(input: EbayListingInput): Promise<{
  ok: boolean;
  ebayListingId?: string;
  url?: string;
  error?: string;
}> {
  const { connected, isSandbox } = await getEbayConnectionStatusInternal();
  if (!connected) return { ok: false, error: "eBay account not connected" };

  let token: string;
  try { token = await getAccessToken(); }
  catch (e) {
    logger.error({ category: "ebay", action: "ebay.token.failed", message: `Could not get access token: ${e}`, targetId: input.listingDbId, targetType: "listing" });
    return { ok: false, error: String(e) };
  }

  const sandbox = isSandbox === "sandbox";
  console.log(`[ebay] createEbayListing: listingId=${input.listingDbId} sku=${input.sku} type=${input.listingType ?? "fixed"} env=${sandbox ? "sandbox" : "production"}`);

  try {
    // 1. Upload photos to EPS
    const uploadedPhotos: string[] = [];
    for (const photoUrl of input.photos.slice(0, 12)) {
      const epsUrl = await uploadPhotoToEbay(photoUrl, token, sandbox);
      if (epsUrl) uploadedPhotos.push(epsUrl);
    }
    console.log(`[ebay] photos: ${uploadedPhotos.length}/${input.photos.length} uploaded`);

    // 2. Ensure merchant location and policies exist
    await ensureMerchantLocation(token, sandbox);
    const policies = await ensurePolicies(token, sandbox);

    // 3. Build item aspects
    const aspects = buildAspects(input);

    // 4. Create inventory item — always delete first to clear any stale eBay associations
    let condition = ebayCondition(input.condition, input.graded, input.conditionType, input.cardCondition, input.isLot);
    if (input.isLot && input.categoryId) {
      // For lots, hard-coding USED_GOOD doesn't work — Trading Card Lots
      // categories accept different conditionIds. Query the category's
      // metadata to pick a valid one.
      condition = await resolveLotConditionEnum(input.categoryId, input.cardCondition ?? "", token, sandbox);
      console.log(`[ebay] lot condition override → ${condition}`);
    }

    const conditionDescriptors = await resolveConditionDescriptors(input, token, sandbox);
    const inventoryPayload = {
      availability: { shipToLocationAvailability: { quantity: 1 } },
      condition,
      conditionDescription: input.graded
        ? `${input.gradeCompany} ${input.grade} graded${input.certNumber ? `, cert #${input.certNumber}` : ""}`
        : (input.condition ?? ""),
      ...(conditionDescriptors.length ? { conditionDescriptors } : {}),
      product: {
        title:       input.title,
        description: toHtmlDescription(input.description),
        imageUrls:   uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
        aspects,
      },
      packageWeightAndSize: {
        dimensions: { length: input.dimLength ?? 11.0, width: input.dimWidth ?? 6.0, height: input.dimHeight ?? 1.0, unit: "INCH" },
        weight: { value: (input.weightLbs ?? 0) * 16 + (input.weightOz ?? 3), unit: "OUNCE" },
      },
    };
    console.log("[ebay] inventory item: conditionDescriptors =", JSON.stringify(inventoryPayload.conditionDescriptors));

    // Always delete first to clear any stale eBay associations from previous listings
    console.log(`[ebay] inventory item: deleting stale item for sku=${input.sku}`);
    await ebayFetch(`/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`, { method: "DELETE" }, token, sandbox);
    console.log(`[ebay] inventory item: PUT sku=${input.sku} condition=${condition} photos=${uploadedPhotos.length}`);
    console.log(`[ebay] inventory item: aspects keys =`, Object.keys(aspects));
    console.log(`[ebay] inventory item: full aspects =`, JSON.stringify(aspects));
    const inventoryR = await ebayFetch(`/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`, {
      method: "PUT", body: JSON.stringify(inventoryPayload),
    }, token, sandbox);

    console.log(`[ebay] inventory item: status ${inventoryR.status}`);
    if (!inventoryR.ok && inventoryR.status !== 204) {
      const err = await inventoryR.json().catch(() => ({}));

      if (inventoryR.status !== 500) {
        logger.error({ category: "ebay", action: "ebay.inventory.failed", message: `Inventory item PUT failed`, data: { status: inventoryR.status, sku: input.sku, err }, targetId: input.listingDbId, targetType: "listing" });
        throw new Error(`Inventory item failed (${inventoryR.status}): ${JSON.stringify(err)}`);
      }

      // Persistent 500 — delete again and retry once more
      console.log(`[ebay] inventory item: 500 from eBay, retrying after second delete…`);
      await ebayFetch(`/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`, { method: "DELETE" }, token, sandbox);
      const retryR = await ebayFetch(`/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`, {
        method: "PUT", body: JSON.stringify(inventoryPayload),
      }, token, sandbox);
      console.log(`[ebay] inventory item: retry status ${retryR.status}`);
      if (!retryR.ok && retryR.status !== 204) {
        const retryErr = await retryR.json().catch(() => ({}));
        logger.error({ category: "ebay", action: "ebay.inventory.failed", message: `Inventory item retry also failed`, data: { status: retryR.status, sku: input.sku, err: retryErr }, targetId: input.listingDbId, targetType: "listing" });
        throw new Error(`Inventory item failed after retry (${retryR.status}): ${JSON.stringify(retryErr)}`);
      }
    }
    console.log(`[ebay] inventory item: ok`);

    // 5. Create offer
    const isAuction = input.listingType === "auction";
    const priceDisplay = isAuction
      ? `auction start $${input.startPrice}${input.buyItNowPrice ? ` BIN $${input.buyItNowPrice}` : ""}`
      : `BIN $${input.buyItNowPrice ?? input.startPrice}`;
    console.log(`[ebay] offer: creating ${isAuction ? "AUCTION" : "FIXED_PRICE"} ${priceDisplay} sku=${input.sku}`);
    const offerBody = buildOfferBody(input, isAuction, policies);

    const offerR = await ebayFetch("/sell/inventory/v1/offer", {
      method: "POST", body: JSON.stringify(offerBody),
    }, token, sandbox);
    const offerData = await offerR.json();
    console.log(`[ebay] offer: create status ${offerR.status}`);

    let offerId: string;
    if (!offerR.ok) {
      const existingId = (offerData.errors?.[0]?.parameters ?? [])
        .find((p: { name: string; value: string }) => p.name === "offerId")?.value;
      if (existingId) {
        console.log(`[ebay] offer: exists (${existingId}), deleting and recreating`);
        const delR = await ebayFetch(`/sell/inventory/v1/offer/${existingId}`, { method: "DELETE" }, token, sandbox);
        console.log(`[ebay] offer: delete status ${delR.status}`);
        const retryR    = await ebayFetch("/sell/inventory/v1/offer", { method: "POST", body: JSON.stringify(offerBody) }, token, sandbox);
        const retryData = await retryR.json();
        console.log(`[ebay] offer: recreate status ${retryR.status}`, retryR.ok ? `offerId=${retryData.offerId}` : JSON.stringify(retryData).slice(0, 200));
        if (!retryR.ok) {
          logger.error({ category: "ebay", action: "ebay.offer.recreate.failed", message: `Offer recreation failed`, data: { status: retryR.status, response: retryData, offerBody }, targetId: input.listingDbId, targetType: "listing" });
          throw new Error(`Offer recreation failed (${retryR.status}): ${JSON.stringify(retryData)}`);
        }
        offerId = retryData.offerId;
      } else {
        logger.error({ category: "ebay", action: "ebay.offer.create.failed", message: `Offer creation failed`, data: { status: offerR.status, response: offerData, offerBody }, targetId: input.listingDbId, targetType: "listing" });
        throw new Error(`Offer creation failed (${offerR.status}): ${JSON.stringify(offerData)}`);
      }
    } else {
      offerId = offerData.offerId;
      console.log(`[ebay] offer: created ${offerId}`);
    }

    // 6. Publish offer
    console.log(`[ebay] publish: posting offer ${offerId}…`);
    const publishR = await ebayFetch(`/sell/inventory/v1/offer/${offerId}/publish`, {
      method: "POST", body: "{}",
    }, token, sandbox);
    const publishData = await publishR.json();
    console.log(`[ebay] publish: status ${publishR.status}`);

    if (!publishR.ok) {
      logger.error({ category: "ebay", action: "ebay.listing.publish.failed", message: `Publish failed: ${publishData?.errors?.[0]?.message ?? "unknown"}`, data: { status: publishR.status, response: publishData, offerId, policies }, targetId: input.listingDbId, targetType: "listing" });
      throw new Error(`Publish failed (${publishR.status}): ${JSON.stringify(publishData)}`);
    }

    const ebayListingId = publishData.listingId;
    const url = sandbox
      ? `https://www.sandbox.ebay.com/itm/${ebayListingId}`
      : `https://www.ebay.com/itm/${ebayListingId}`;

    console.log(`[ebay] published! listingId=${ebayListingId} → ${url}`);
    logger.info({ category: "ebay", action: "ebay.listing.published", message: `Listing published: ${ebayListingId}`, data: { ebayListingId, url, offerId, sku: input.sku, env: sandbox ? "sandbox" : "production" }, targetId: input.listingDbId, targetType: "listing" });

    return { ok: true, ebayListingId, url };

  } catch (e) {
    console.error("[ebay] createEbayListing error:", e);
    logger.error({ category: "ebay", action: "ebay.listing.failed", message: String(e), data: { sku: input.sku }, targetId: input.listingDbId, targetType: "listing" });
    return { ok: false, error: String(e) };
  }
}

export async function reviseEbayListing(input: EbayListingInput): Promise<{ ok: boolean; newListingId?: string; newUrl?: string; error?: string }> {
  const { connected, isSandbox } = await getEbayConnectionStatusInternal();
  if (!connected) return { ok: false, error: "eBay account not connected" };

  let token: string;
  try { token = await getAccessToken(); }
  catch (e) { return { ok: false, error: String(e) }; }

  const sandbox = isSandbox === "sandbox";
  console.log(`[ebay] reviseEbayListing: listingId=${input.listingDbId} sku=${input.sku} env=${sandbox ? "sandbox" : "production"}`);

  try {
    // 1. Upload photos
    const uploadedPhotos: string[] = [];
    for (const photoUrl of input.photos.slice(0, 12)) {
      const epsUrl = await uploadPhotoToEbay(photoUrl, token, sandbox);
      if (epsUrl) uploadedPhotos.push(epsUrl);
    }
    console.log(`[ebay] revise photos: ${uploadedPhotos.length}/${input.photos.length} uploaded`);

    // 2. Update inventory item (no delete — listing is live)
    let condition = ebayCondition(input.condition, input.graded, input.conditionType, input.cardCondition, input.isLot);
    if (input.isLot && input.categoryId) {
      // For lots, hard-coding USED_GOOD doesn't work — Trading Card Lots
      // categories accept different conditionIds. Query the category's
      // metadata to pick a valid one.
      condition = await resolveLotConditionEnum(input.categoryId, input.cardCondition ?? "", token, sandbox);
      console.log(`[ebay] lot condition override → ${condition}`);
    }
    const aspects   = buildAspects(input);
    const conditionDescriptors = await resolveConditionDescriptors(input, token, sandbox);
    console.log(`[ebay] revise: updating inventory item sku=${input.sku}`);
    const inventoryR = await ebayFetch(`/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`, {
      method: "PUT",
      body: JSON.stringify({
        availability: { shipToLocationAvailability: { quantity: 1 } },
        condition,
        conditionDescription: input.graded
          ? `${input.gradeCompany} ${input.grade} graded${input.certNumber ? `, cert #${input.certNumber}` : ""}`
          : (input.condition ?? ""),
        ...(conditionDescriptors.length ? { conditionDescriptors } : {}),
        product: {
          title:       input.title,
          description: toHtmlDescription(input.description),
          imageUrls:   uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
          aspects,
        },
        packageWeightAndSize: {
          dimensions: { length: input.dimLength ?? 11.0, width: input.dimWidth ?? 6.0, height: input.dimHeight ?? 1.0, unit: "INCH" },
          weight: { value: (input.weightLbs ?? 0) * 16 + (input.weightOz ?? 3), unit: "OUNCE" },
        },
      }),
    }, token, sandbox);
    console.log(`[ebay] revise: inventory status ${inventoryR.status}`);
    if (!inventoryR.ok && inventoryR.status !== 204) {
      const err = await inventoryR.json().catch(() => ({}));
      logger.error({ category: "ebay", action: "ebay.revise.inventory.failed", message: `Inventory update failed`, data: { status: inventoryR.status, err }, targetId: input.listingDbId, targetType: "listing" });
      throw new Error(`Inventory update failed (${inventoryR.status}): ${JSON.stringify(err)}`);
    }

    // 3. Look up the published offer by SKU
    const offersR = await ebayFetch(`/sell/inventory/v1/offer?sku=${encodeURIComponent(input.sku)}`, { method: "GET" }, token, sandbox);
    console.log(`[ebay] revise: offer lookup status ${offersR.status}`);
    if (!offersR.ok) {
      const err = await offersR.json().catch(() => ({}));
      throw new Error(`Offer lookup failed (${offersR.status}): ${JSON.stringify(err)}`);
    }
    const offersData  = await offersR.json();
    const existing = (offersData.offers ?? []).find((o: { status: string; offerId: string }) => o.status === "PUBLISHED");
    if (!existing?.offerId) throw new Error("No published offer found for this SKU — the listing may have ended");

    // 4. Build offer body and detect format change
    const isAuction     = input.listingType === "auction";
    const desiredFormat = isAuction ? "AUCTION" : "FIXED_PRICE";
    const formatChanged = (existing.format ?? "FIXED_PRICE") !== desiredFormat;
    const policies = {
      fulfillmentPolicyId:  await getCred(ek("ebay_fulfillment_policy_id",   sandbox)) ?? "",
      freeShippingPolicyId: await getCred(ek("ebay_free_shipping_policy_id", sandbox)) ?? "",
      paymentPolicyId:      await getCred(ek("ebay_payment_policy_id",       sandbox)) ?? "",
      returnPolicyId:       await getCred(ek("ebay_return_policy_id",        sandbox)) ?? "",
    };
    const offerBody = buildOfferBody(input, isAuction, policies);

    if (formatChanged) {
      // eBay doesn't allow changing format via offer update — must end and relist
      console.log(`[ebay] revise: format changed (${existing.format} → ${desiredFormat}), doing end+relist`);

      // End the live listing via Trading API
      const ebayListingId = input.existingEbayListingId ?? existing.listing?.listingId;
      if (ebayListingId) {
        const [appId, devId, certId] = await Promise.all([
          getCred(ek("ebay_app_id", sandbox)), getCred("ebay_dev_id"), getCred(ek("ebay_cert_id", sandbox)),
        ]);
        const endXml = `<?xml version="1.0" encoding="utf-8"?><EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials><ItemID>${ebayListingId}</ItemID><EndingReason>NotAvailable</EndingReason></EndItemRequest>`;
        const base = sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
        const endR    = await fetch(`${base}/ws/api.dll`, {
          method: "POST",
          headers: {
            "X-EBAY-API-CALL-NAME": "EndItem", "X-EBAY-API-SITEID": "0",
            "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
            "X-EBAY-API-APP-NAME": appId ?? "", "X-EBAY-API-DEV-NAME": devId ?? "", "X-EBAY-API-CERT-NAME": certId ?? "",
            "Content-Type": "text/xml;charset=utf-8",
          },
          body: endXml,
        });
        const endText = await endR.text();
        const endAck  = endText.match(/<Ack>(\w+)<\/Ack>/)?.[1];
        if (endAck !== "Success" && endAck !== "Warning") {
          const errMsg = endText.match(/<LongMessage>([^<]+)<\/LongMessage>/)?.[1]
                      ?? endText.match(/<ShortMessage>([^<]+)<\/ShortMessage>/)?.[1]
                      ?? "Could not end listing";
          if (/bid/i.test(errMsg)) {
            console.log(`[ebay] revise: cannot end auction — bids exist on ${ebayListingId}`);
            logger.warn({ category: "ebay", action: "ebay.revise.bids.blocked", message: `Format change blocked — auction has bids`, data: { ebayListingId }, targetId: input.listingDbId, targetType: "listing" });
            return { ok: false, error: "This auction has bids and cannot be ended to change the format. Wait for the auction to close, then relist with the new format." };
          }
          throw new Error(`EndItem failed: ${errMsg}`);
        }
        console.log(`[ebay] revise: ended listing ${ebayListingId}`);
      }

      // Delete old offer
      await ebayFetch(`/sell/inventory/v1/offer/${existing.offerId}`, { method: "DELETE" }, token, sandbox);
      // Delete+recreate inventory item to clear stale eBay state
      await ebayFetch(`/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`, { method: "DELETE" }, token, sandbox);
      const invR = await ebayFetch(`/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`, {
        method: "PUT",
        body: JSON.stringify({
          availability: { shipToLocationAvailability: { quantity: 1 } },
          condition: ebayCondition(input.condition, input.graded, input.conditionType, input.cardCondition),
          conditionDescription: input.graded ? `${input.gradeCompany} ${input.grade} graded${input.certNumber ? `, cert #${input.certNumber}` : ""}` : (input.condition ?? ""),
          ...(conditionDescriptors.length ? { conditionDescriptors } : {}),
          product: { title: input.title, description: toHtmlDescription(input.description), imageUrls: uploadedPhotos.length > 0 ? uploadedPhotos : undefined, aspects },
          packageWeightAndSize: { dimensions: { length: input.dimLength ?? 11.0, width: input.dimWidth ?? 6.0, height: input.dimHeight ?? 1.0, unit: "INCH" }, weight: { value: (input.weightLbs ?? 0) * 16 + (input.weightOz ?? 3), unit: "OUNCE" } },
        }),
      }, token, sandbox);
      console.log(`[ebay] revise: inventory recreated (${invR.status})`);

      // Create new offer with new format
      const newOfferR    = await ebayFetch("/sell/inventory/v1/offer", { method: "POST", body: JSON.stringify(offerBody) }, token, sandbox);
      const newOfferData = await newOfferR.json();
      if (!newOfferR.ok) throw new Error(`New offer creation failed (${newOfferR.status}): ${JSON.stringify(newOfferData)}`);
      const newOfferId = newOfferData.offerId;
      console.log(`[ebay] revise: new offer created ${newOfferId}`);

      // Publish
      const pubR    = await ebayFetch(`/sell/inventory/v1/offer/${newOfferId}/publish`, { method: "POST", body: "{}" }, token, sandbox);
      const pubData = await pubR.json();
      if (!pubR.ok) throw new Error(`Publish failed (${pubR.status}): ${JSON.stringify(pubData)}`);
      const newListingId = pubData.listingId;
      const newUrl = sandbox ? `https://www.sandbox.ebay.com/itm/${newListingId}` : `https://www.ebay.com/itm/${newListingId}`;
      console.log(`[ebay] revise: relisted as ${desiredFormat} — ${newListingId}`);
      logger.info({ category: "ebay", action: "ebay.listing.relisted", message: `Relisted with new format ${desiredFormat}`, data: { newListingId, newUrl }, targetId: input.listingDbId, targetType: "listing" });
      return { ok: true, newListingId, newUrl };
    }

    // For a scheduled listing whose start time is changing, the Inventory API's offer PUT
    // silently ignores `listingStartDate` once the offer is PUBLISHED. The Trading API's
    // ReviseFixedPriceItem rejects inventory-based listings. The only working path is to
    // withdraw the published offer, update it (now in UNPUBLISHED state), then republish.
    // This creates a new eBay listing ID — we return it so the caller can update the DB.
    const isFutureScheduled = !!input.scheduledTime && new Date(input.scheduledTime).getTime() > Date.now();
    const existingListingId = input.existingEbayListingId ?? existing.listing?.listingId;
    const isScheduledOnEbay = existing.status === "PUBLISHED" && !!existingListingId;

    if (isFutureScheduled && isScheduledOnEbay) {
      console.log(`[ebay] revise: scheduled-time change — withdrawing offer ${existing.offerId} to update listingStartDate`);
      const withdrawR = await ebayFetch(`/sell/inventory/v1/offer/${existing.offerId}/withdraw`, {
        method: "POST", body: "{}",
      }, token, sandbox);
      console.log(`[ebay] revise: withdraw status ${withdrawR.status}`);
      if (!withdrawR.ok) {
        const err = await withdrawR.json().catch(() => ({}));
        throw new Error(`Could not withdraw published offer to change start time (${withdrawR.status}): ${JSON.stringify(err)}`);
      }

      // Update the (now UNPUBLISHED) offer with the new listingStartDate + everything else
      const updateR = await ebayFetch(`/sell/inventory/v1/offer/${existing.offerId}`, {
        method: "PUT", body: JSON.stringify(offerBody),
      }, token, sandbox);
      console.log(`[ebay] revise: offer update (after withdraw) status ${updateR.status}`);
      if (!updateR.ok) {
        const err = await updateR.json().catch(() => ({}));
        throw new Error(`Offer update after withdraw failed (${updateR.status}): ${JSON.stringify(err)}`);
      }

      // Republish — eBay assigns a new listing ID
      const repubR = await ebayFetch(`/sell/inventory/v1/offer/${existing.offerId}/publish`, {
        method: "POST", body: "{}",
      }, token, sandbox);
      const repubData = await repubR.json();
      console.log(`[ebay] revise: republish status ${repubR.status}`);
      if (!repubR.ok) {
        throw new Error(`Republish failed (${repubR.status}): ${JSON.stringify(repubData)}`);
      }
      const newListingId = repubData.listingId;
      const newUrl = sandbox ? `https://www.sandbox.ebay.com/itm/${newListingId}` : `https://www.ebay.com/itm/${newListingId}`;
      console.log(`[ebay] revise: rescheduled — new listingId=${newListingId}`);
      logger.info({ category: "ebay", action: "ebay.listing.rescheduled", message: `Rescheduled with new listingId`, data: { oldListingId: existingListingId, newListingId, newUrl }, targetId: input.listingDbId, targetType: "listing" });
      return { ok: true, newListingId, newUrl };
    }

    // Normal update — same format, listing already live (or no scheduled change), just update the offer
    console.log(`[ebay] revise: updating offer ${existing.offerId}`);
    const offerR = await ebayFetch(`/sell/inventory/v1/offer/${existing.offerId}`, {
      method: "PUT", body: JSON.stringify(offerBody),
    }, token, sandbox);
    console.log(`[ebay] revise: offer update status ${offerR.status}`);
    if (!offerR.ok) {
      const err = await offerR.json().catch(() => ({}));
      logger.error({ category: "ebay", action: "ebay.revise.offer.failed", message: `Offer update failed`, data: { status: offerR.status, err, offerId: existing.offerId }, targetId: input.listingDbId, targetType: "listing" });
      throw new Error(`Offer update failed (${offerR.status}): ${JSON.stringify(err)}`);
    }

    console.log(`[ebay] revise: done — listing ${input.listingDbId} updated`);
    logger.info({ category: "ebay", action: "ebay.listing.revised", message: `Listing revised: ${input.listingDbId}`, data: { sku: input.sku, offerId: existing.offerId }, targetId: input.listingDbId, targetType: "listing" });
    return { ok: true };

  } catch (e) {
    console.error("[ebay] reviseEbayListing error:", e);
    logger.error({ category: "ebay", action: "ebay.revise.failed", message: String(e), data: { sku: input.sku }, targetId: input.listingDbId, targetType: "listing" });
    return { ok: false, error: String(e) };
  }
}

// Internal helper to get env as boolean
async function getEbayConnectionStatusInternal() {
  const status = await getEbayConnectionStatus();
  return { connected: status.connected, isSandbox: status.environment };
}
