import { db } from "@/lib/db";
import { CredentialsClient } from "./CredentialsClient";

// ── Seed template ─────────────────────────────────────────────────────────────
// Used ONCE to pre-populate the database on first visit.
// After that, the DB is the sole source of truth — delete a row and it's gone.

const SEED: { service: string; label: string; group: string; hint?: string; auto?: boolean }[] = [
  // Email — SMTP (primary) + Resend (fallback)
  { service: "smtp_host",       label: "SMTP Host",                group: "Email — SMTP",        hint: "e.g. smtppro.zoho.com" },
  { service: "smtp_port",       label: "SMTP Port",                group: "Email — SMTP",        hint: "587 (TLS) or 465 (SSL)" },
  { service: "smtp_user",       label: "SMTP Username",            group: "Email — SMTP",        hint: "support@thecardcloud.com" },
  { service: "smtp_pass",       label: "SMTP Password",            group: "Email — SMTP",        hint: "Your email account password" },
  { service: "smtp_secure",     label: "SMTP Secure (SSL)",        group: "Email — SMTP",        hint: "true for port 465, false for 587" },
  { service: "smtp_from",       label: "From Address",             group: "Email — SMTP",        hint: "The Card Cloud <support@thecardcloud.com>" },
  { service: "resend_api_key",  label: "Resend API Key (fallback)", group: "Email — SMTP",       hint: "re_... (optional, used if SMTP not set)" },
  // Payments
  { service: "stripe_pk",       label: "Stripe Publishable Key",   group: "Payments",            hint: "pk_live_..." },
  { service: "stripe_sk",       label: "Stripe Secret Key",        group: "Payments",            hint: "sk_live_..." },
  { service: "stripe_webhook",  label: "Stripe Webhook Secret",    group: "Payments",            hint: "whsec_..." },
  // Grading APIs
  { service: "psa_api_key",     label: "PSA API Key",              group: "Grading APIs",        hint: "Bearer token from PSA dev portal" },
  { service: "sgc_api_key",     label: "SGC API Key",              group: "Grading APIs",        hint: "If/when SGC opens an API" },
  // Social Auth
  { service: "google_client_id",     label: "Google Client ID",     group: "Social Auth",        hint: "xxx.apps.googleusercontent.com" },
  { service: "google_client_secret", label: "Google Client Secret", group: "Social Auth",        hint: "GOCSPX-..." },
  { service: "apple_client_id",      label: "Apple Client ID",      group: "Social Auth",        hint: "com.yourapp.service" },
  { service: "apple_team_id",        label: "Apple Team ID",        group: "Social Auth",        hint: "10-char team ID" },
  { service: "apple_key_id",         label: "Apple Key ID",         group: "Social Auth",        hint: "10-char key ID" },
  { service: "apple_private_key",    label: "Apple Private Key",    group: "Social Auth",        hint: "-----BEGIN PRIVATE KEY-----..." },
  // eBay — shared settings
  { service: "ebay_environment", label: "Environment",              group: "Marketplace — eBay", hint: "sandbox or production" },
  { service: "ebay_dev_id",      label: "Dev ID (shared)",          group: "Marketplace — eBay", hint: "Same for sandbox and production" },
  // eBay — Sandbox credentials
  { service: "ebay_app_id",      label: "App ID (Client ID)",       group: "eBay — Sandbox", hint: "Sandbox Client ID from developer.ebay.com" },
  { service: "ebay_cert_id",     label: "Cert ID (Client Secret)",  group: "eBay — Sandbox" },
  { service: "ebay_ru_name",     label: "RuName",                   group: "eBay — Sandbox", hint: "Sandbox RuName" },
  { service: "ebay_access_token",            label: "Access Token",            group: "eBay — Sandbox", auto: true },
  { service: "ebay_refresh_token",           label: "Refresh Token",           group: "eBay — Sandbox", auto: true },
  { service: "ebay_token_expires_at",        label: "Token Expiry",            group: "eBay — Sandbox", auto: true },
  { service: "ebay_seller_username",         label: "Seller Username",         group: "eBay — Sandbox", auto: true },
  { service: "ebay_merchant_location_key",   label: "Merchant Location Key",   group: "eBay — Sandbox", auto: true },
  { service: "ebay_fulfillment_policy_id",   label: "Fulfillment Policy ID",   group: "eBay — Sandbox", auto: true },
  { service: "ebay_free_shipping_policy_id", label: "Free Shipping Policy ID", group: "eBay — Sandbox", auto: true },
  { service: "ebay_return_policy_id",        label: "Return Policy ID",        group: "eBay — Sandbox", auto: true },
  { service: "ebay_payment_policy_id",       label: "Payment Policy ID",       group: "eBay — Sandbox", auto: true },
  // eBay — Production credentials
  { service: "ebay_app_id_prod",      label: "App ID (Client ID)",       group: "eBay — Production", hint: "Production Client ID from developer.ebay.com" },
  { service: "ebay_cert_id_prod",     label: "Cert ID (Client Secret)",  group: "eBay — Production" },
  { service: "ebay_ru_name_prod",     label: "RuName",                   group: "eBay — Production", hint: "Production RuName" },
  { service: "ebay_access_token_prod",            label: "Access Token",            group: "eBay — Production", auto: true },
  { service: "ebay_refresh_token_prod",           label: "Refresh Token",           group: "eBay — Production", auto: true },
  { service: "ebay_token_expires_at_prod",        label: "Token Expiry",            group: "eBay — Production", auto: true },
  { service: "ebay_seller_username_prod",         label: "Seller Username",         group: "eBay — Production", auto: true },
  { service: "ebay_merchant_location_key_prod",   label: "Merchant Location Key",   group: "eBay — Production", auto: true },
  { service: "ebay_fulfillment_policy_id_prod",   label: "Fulfillment Policy ID",   group: "eBay — Production", auto: true },
  { service: "ebay_free_shipping_policy_id_prod", label: "Free Shipping Policy ID", group: "eBay — Production", auto: true },
  { service: "ebay_return_policy_id_prod",        label: "Return Policy ID",        group: "eBay — Production", auto: true },
  { service: "ebay_payment_policy_id_prod",       label: "Payment Policy ID",       group: "eBay — Production", auto: true },
  // Storage
  { service: "r2_account_id",  label: "Cloudflare R2 Account ID", group: "Storage", hint: "32-char hex string from R2 bucket's S3 API URL" },
  { service: "r2_access_key",  label: "R2 Access Key ID",         group: "Storage" },
  { service: "r2_secret_key",  label: "R2 Secret Access Key",     group: "Storage" },
  { service: "r2_bucket",      label: "R2 Bucket Name",           group: "Storage", hint: "e.g. cardcloud-photos" },
  { service: "r2_public_url",  label: "R2 Public URL",            group: "Storage", hint: "https://pub-<hash>.r2.dev (or custom domain) — no trailing slash" },
  // AI / ML
  { service: "anthropic_api_key", label: "Anthropic API Key",            group: "AI / ML",      hint: "sk-ant-..." },
  { service: "ollama_url",        label: "Ollama Base URL",              group: "AI / ML",      hint: "http://localhost:11434" },
  { service: "article_api_key",   label: "Article Submission API Key",   group: "Article API",  hint: "Any secret token — AI agents use this to POST /api/articles" },
  // Twilio — SMS + voice alerts
  { service: "twilio_account_sid",  label: "Account SID",    group: "Twilio", hint: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
  { service: "twilio_auth_token",   label: "Auth Token",     group: "Twilio", hint: "From your Twilio Console dashboard" },
  { service: "twilio_from_number",  label: "From Number",    group: "Twilio", hint: "+1xxxxxxxxxx — your Twilio phone number" },
];

// Canonical group order — predefined groups appear in this order on the page
const GROUP_ORDER = [
  "Email", "Payments", "Grading APIs", "Social Auth",
  "Marketplace — eBay", "eBay — Sandbox", "eBay — Production", "Storage", "AI / ML", "Twilio",
];

const HINTS     = new Map(SEED.map(s => [s.service, s.hint]));
const AUTO_SVCS = new Set(SEED.filter(s => s.auto).map(s => s.service));

export interface CredItem      { service: string; label: string; value: string; hint?: string; auto?: boolean }
export interface GroupData     { name: string; items: CredItem[]; activeEnvGroup?: boolean }
export interface EbayEnvStatus { connected: boolean; seller?: string; expiresAt?: string }

export default async function CredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ ebay_connected?: string; ebay_error?: string; env?: string }>;
}) {
  const sp = await searchParams;
  // ── Seed missing predefined credentials ─────────────────────────────────
  let stored = await db.siteCredential.findMany();
  const existing = new Set(stored.map(c => c.service));

  const toCreate = SEED.filter(s => !existing.has(s.service));
  if (toCreate.length > 0) {
    await db.siteCredential.createMany({
      data: toCreate.map(s => ({ service: s.service, label: s.label, value: "", group: s.group })),
    });
    stored = await db.siteCredential.findMany();
  }

  // Also fix any predefined items that exist but are missing their group
  for (const s of SEED) {
    const row = stored.find(c => c.service === s.service);
    if (row && !row.group) {
      await db.siteCredential.update({ where: { service: s.service }, data: { group: s.group } });
      row.group = s.group;
    }
  }

  // ── Build ordered groups ─────────────────────────────────────────────────
  const groupMap = new Map<string, CredItem[]>();
  for (const c of stored) {
    const name = c.group ?? "Other";
    if (!groupMap.has(name)) groupMap.set(name, []);
    groupMap.get(name)!.push({
      service: c.service,
      label:   c.label,
      value:   c.value,
      hint:    HINTS.get(c.service),
      auto:    AUTO_SVCS.has(c.service),
    });
  }

  // Sort: predefined order first, then alphabetical for user-created groups
  const allGroupNames = [...groupMap.keys()];
  const ordered = [
    ...GROUP_ORDER.filter(g => groupMap.has(g)),
    ...allGroupNames.filter(g => !GROUP_ORDER.includes(g)).sort(),
  ];

  // Determine active eBay environment for visual highlighting
  const activeEnv = stored.find(c => c.service === "ebay_environment")?.value ?? "sandbox";
  const activeEbayGroup = activeEnv === "production" ? "eBay — Production" : "eBay — Sandbox";

  const groups: GroupData[] = ordered.map(name => ({
    name,
    items: groupMap.get(name)!,
    activeEnvGroup: name === activeEbayGroup,
  }));

  // Per-environment eBay connection status
  const cred = (svc: string) => stored.find(c => c.service === svc)?.value ?? "";
  const ebayStatus: { sandbox: EbayEnvStatus; production: EbayEnvStatus } = {
    sandbox: {
      connected:  !!cred("ebay_access_token"),
      seller:     cred("ebay_seller_username")     || undefined,
      expiresAt:  cred("ebay_token_expires_at")    || undefined,
    },
    production: {
      connected:  !!cred("ebay_access_token_prod"),
      seller:     cred("ebay_seller_username_prod") || undefined,
      expiresAt:  cred("ebay_token_expires_at_prod") || undefined,
    },
  };

  const successMsg = sp.ebay_connected
    ? `eBay ${sp.env ?? "sandbox"} account connected successfully!`
    : undefined;
  const errorMsg = sp.ebay_error
    ? `eBay connection error: ${sp.ebay_error}`
    : undefined;

  return (
    <CredentialsClient
      groups={groups}
      allGroupNames={ordered}
      ebayStatus={ebayStatus}
      successMsg={successMsg}
      errorMsg={errorMsg}
    />
  );
}
