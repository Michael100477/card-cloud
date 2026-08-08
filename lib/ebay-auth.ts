import { db } from "./db";
import { logger } from "./logger";

// ── Credential helpers ────────────────────────────────────────────────────

async function getCred(service: string): Promise<string | null> {
  const row = await db.siteCredential.findUnique({ where: { service }, select: { value: true } });
  return row?.value || null;
}

// Returns the credential key for the current environment.
// Production credentials use a _prod suffix; sandbox use the base key.
async function envKey(base: string): Promise<string> {
  const env = await getCred("ebay_environment");
  return env === "production" ? `${base}_prod` : base;
}

async function setCred(service: string, label: string, value: string) {
  await db.siteCredential.upsert({
    where:  { service },
    update: { value },
    create: { service, label, value },
  });
}

// ── Environment URLs ──────────────────────────────────────────────────────

async function getEnv() {
  const env = (await getCred("ebay_environment")) ?? "production";
  const isSandbox = env === "sandbox";
  return {
    authBase:  isSandbox ? "https://auth.sandbox.ebay.com"  : "https://auth.ebay.com",
    apiBase:   isSandbox ? "https://api.sandbox.ebay.com"   : "https://api.ebay.com",
    isSandbox,
  };
}

// ── OAuth scopes ──────────────────────────────────────────────────────────

const SCOPES = [
  // NOTE: the base "https://api.ebay.com/oauth/api_scope" is deliberately
  // omitted here. eBay removed it from the Authorization Code Grant Type
  // flow when sell.logistics was assigned to our app. Commerce APIs that
  // still need the base scope (e.g. Taxonomy) use getAppAccessToken()
  // below — Client Credentials Grant Type, which retains this scope.
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",            // mark orders shipped
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",   // read order status
  "https://api.ebay.com/oauth/api_scope/sell.finances",               // payout amounts for Payout tab
  "https://api.ebay.com/oauth/api_scope/sell.logistics",              // shipping quote + buy labels (eBay Standard Envelope for cards <3oz) — granted 2026-08-08 via ticket #260612-000021
  "https://api.ebay.com/oauth/api_scope/commerce.message",
].join(" ");

// ── Build authorization URL ───────────────────────────────────────────────

// Local dev shares Railway's database (DATABASE_URL → Railway). All eBay
// OAuth flows therefore use the Railway-registered RuName regardless of
// whether the user kicked off the flow from localhost or from Railway —
// eBay redirects to Railway's callback, tokens land in Railway DB, and the
// localhost UI just reads the same tokens.

export async function buildAuthUrl(state: string, env?: "sandbox" | "production"): Promise<string | null> {
  const resolvedEnv = env ?? ((await getCred("ebay_environment")) as "sandbox" | "production") ?? "sandbox";
  const suffix   = resolvedEnv === "production" ? "_prod" : "";
  const authBase = resolvedEnv === "sandbox" ? "https://auth.sandbox.ebay.com" : "https://auth.ebay.com";
  const [appId, ruName] = await Promise.all([
    getCred(`ebay_app_id${suffix}`),
    getCred(`ebay_ru_name${suffix}`),
  ]);
  if (!appId || !ruName) return null;
  const params = new URLSearchParams({
    client_id:     appId,
    response_type: "code",
    redirect_uri:  ruName,
    scope:         SCOPES,
    state,
    prompt:        "consent",
  });
  return `${authBase}/oauth2/authorize?${params}`;
}

// ── Exchange auth code for tokens ─────────────────────────────────────────

export async function exchangeCode(code: string, env?: "sandbox" | "production"): Promise<{ ok: boolean; error?: string }> {
  const resolvedEnv = env ?? ((await getCred("ebay_environment")) as "sandbox" | "production") ?? "sandbox";
  const suffix  = resolvedEnv === "production" ? "_prod" : "";
  const apiBase = resolvedEnv === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  const [appId, certId, ruName] = await Promise.all([
    getCred(`ebay_app_id${suffix}`),
    getCred(`ebay_cert_id${suffix}`),
    getCred(`ebay_ru_name${suffix}`),
  ]);
  if (!appId || !certId || !ruName) return { ok: false, error: "Missing eBay credentials" };

  const credentials = Buffer.from(`${appId}:${certId}`).toString("base64");

  const r = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: ruName,
    }),
  });

  const data = await r.json();
  if (!r.ok) return { ok: false, error: data.error_description ?? "Token exchange failed" };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await Promise.all([
    setCred(`ebay_access_token${suffix}`,     "eBay Access Token",     data.access_token),
    setCred(`ebay_refresh_token${suffix}`,    "eBay Refresh Token",    data.refresh_token),
    setCred(`ebay_token_expires_at${suffix}`, "eBay Token Expires At", expiresAt),
    setCred(`ebay_seller_username${suffix}`,  "eBay Seller Username",  data.token_user_id ?? ""),
  ]);

  logger.info({ category: "ebay", action: "ebay.auth.connected", message: `eBay ${resolvedEnv} account connected via OAuth (seller: ${data.token_user_id ?? "unknown"})` });
  return { ok: true };
}

// ── Get a valid access token (auto-refresh) ───────────────────────────────

export async function getAccessToken(): Promise<string> {
  const [token, expiresAt, refreshToken] = await Promise.all([
    getCred(await envKey("ebay_access_token")),
    getCred(await envKey("ebay_token_expires_at")),
    getCred(await envKey("ebay_refresh_token")),
  ]);

  // Use existing token if it has more than 2 minutes left
  if (token && expiresAt && new Date(expiresAt).getTime() > Date.now() + 120_000) {
    return token;
  }

  if (!refreshToken) throw new Error("No eBay refresh token stored — reconnect your eBay account.");

  const [appId, certId] = await Promise.all([
    getCred(await envKey("ebay_app_id")),
    getCred(await envKey("ebay_cert_id")),
  ]);
  if (!appId || !certId) throw new Error("Missing eBay App ID or Cert ID");

  const { apiBase } = await getEnv();
  const credentials  = Buffer.from(`${appId}:${certId}`).toString("base64");

  const r = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
      // NOTE: deliberately NOT passing scope here. eBay reuses whatever scopes
      // were granted at the original OAuth handshake. Passing the current
      // SCOPES list breaks when we've added scopes (e.g. sell.fulfillment
      // write) that weren't on the refresh_token — eBay returns invalid_scope
      // and every background monitor crashes in a loop.
    }),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data.error_description ?? "Token refresh failed");

  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  const [atKey2, teKey2] = await Promise.all([
    envKey("ebay_access_token"), envKey("ebay_token_expires_at"),
  ]);
  await Promise.all([
    setCred(atKey2, "eBay Access Token",     data.access_token),
    setCred(teKey2, "eBay Token Expires At", newExpiresAt),
  ]);

  return data.access_token;
}

// ── App-only access token (Client Credentials Grant) ──────────────────────
// For Commerce APIs (Taxonomy, etc.) that only need application identity,
// not seller identity. Kept separate from the user OAuth flow because eBay
// removed the base "oauth/api_scope" from the Authorization Code Grant Type
// flow when we were granted sell.logistics — that scope is still available
// via Client Credentials Grant Type.
//
// Token stored in SiteCredential under the same _prod / no-suffix pattern
// as the user tokens. No refresh token (Client Credentials just re-mints).

export async function getAppAccessToken(): Promise<string> {
  const [atKey, teKey] = await Promise.all([
    envKey("ebay_app_access_token"),
    envKey("ebay_app_token_expires_at"),
  ]);
  const [token, expiresAt] = await Promise.all([getCred(atKey), getCred(teKey)]);

  // Reuse if it has more than 2 minutes left
  if (token && expiresAt && new Date(expiresAt).getTime() > Date.now() + 120_000) {
    return token;
  }

  const [appId, certId] = await Promise.all([
    getCred(await envKey("ebay_app_id")),
    getCred(await envKey("ebay_cert_id")),
  ]);
  if (!appId || !certId) throw new Error("Missing eBay App ID or Cert ID");

  const { apiBase } = await getEnv();
  const credentials = Buffer.from(`${appId}:${certId}`).toString("base64");

  const r = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope:      "https://api.ebay.com/oauth/api_scope",
    }),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data.error_description ?? "App token mint failed");

  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await Promise.all([
    setCred(atKey, "eBay App Access Token",     data.access_token),
    setCred(teKey, "eBay App Token Expires At", newExpiresAt),
  ]);

  return data.access_token;
}

// ── App ID (needed for Trading API headers) ───────────────────────────────

export async function getAppId(): Promise<string | null> {
  return getCred(await envKey("ebay_app_id"));
}

// ── Trading API base URL (environment-aware) ──────────────────────────────

export async function getTradingApiUrl(): Promise<string> {
  const { apiBase } = await getEnv();
  return `${apiBase}/ws/api.dll`;
}

// ── Connection status ─────────────────────────────────────────────────────

export async function getEbayConnectionStatus(): Promise<{
  connected: boolean;
  seller: string | null;
  expiresAt: string | null;
  environment: string;
}> {
  const currentEnv = await getCred("ebay_environment") ?? "sandbox";
  const [token, seller, expiresAt] = await Promise.all([
    getCred(currentEnv === "production" ? "ebay_access_token_prod" : "ebay_access_token"),
    getCred(currentEnv === "production" ? "ebay_seller_username_prod" : "ebay_seller_username"),
    getCred(currentEnv === "production" ? "ebay_token_expires_at_prod" : "ebay_token_expires_at"),
  ]);
  const env = currentEnv;
  return {
    connected:   !!token,
    seller:      seller || null,
    expiresAt:   expiresAt || null,
    environment: env ?? "production",
  };
}
