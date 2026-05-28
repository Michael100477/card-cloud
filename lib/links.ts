/**
 * Server-side link management — DB access, seeding, full map loading.
 * Import from "@/lib/links-utils" in Client Components instead.
 */
import { db } from "./db";
export type { SiteLink, LinksMap } from "./links-utils";
export { getLink } from "./links-utils";
import type { LinksMap, SiteLink } from "./links-utils";

/** All seed links with their defaults. Used to populate DB on first load. */
export const LINK_SEED: Omit<SiteLink, "updatedAt">[] = [
  // Navigation
  { key: "nav_explore",           section: "Navigation",   label: "Explore",                    href: "/explore",   enabled: true,  order: 1  },
  { key: "nav_articles",          section: "Navigation",   label: "Articles",                   href: "/articles",  enabled: true,  order: 2  },
  { key: "nav_login",             section: "Navigation",   label: "Log in",                     href: "/login",     enabled: true,  order: 3  },
  { key: "nav_signup",            section: "Navigation",   label: "Sign up free",               href: "/signup",    enabled: true,  order: 4  },
  // Service Cards (Hero section)
  { key: "service_track_cta",     section: "Service Cards",label: "Start tracking",             href: "/signup",    enabled: true,  order: 10 },
  { key: "service_sell_cta",      section: "Service Cards",label: "Start selling",              href: "/exchange/sell", enabled: true,  order: 11 },
  { key: "service_offer_cta",     section: "Service Cards",label: "Get an offer",               href: "/signup",        enabled: true,  order: 12 },
  { key: "service_consign_cta",   section: "Service Cards",label: "Consign now",                href: "/signup",    enabled: true,  order: 12 },
  { key: "service_trade_cta",     section: "Service Cards",label: "Browse trades",              href: "/signup",    enabled: true,  order: 13 },
  // Community section
  { key: "community_secondary",   section: "Community",    label: "Browse collector profiles",  href: "/explore",   enabled: true,  order: 20 },
  // Footer CTA
  { key: "footer_signup",         section: "Footer CTA",   label: "Sign up free",               href: "/signup",    enabled: true,  order: 30 },
  { key: "footer_login",          section: "Footer CTA",   label: "Log in",                     href: "/login",     enabled: true,  order: 31 },
  // Footer legal
  { key: "footer_privacy",        section: "Footer Legal",       label: "Privacy",             href: "/privacy",      enabled: true, order: 40 },
  { key: "footer_terms",          section: "Footer Legal",       label: "Terms",               href: "/terms",        enabled: true, order: 41 },
  { key: "footer_contact",        section: "Footer Legal",       label: "Contact",             href: "/contact",      enabled: true, order: 42 },
  // Footer — Platform column
  { key: "footer_platform_track",   section: "Footer — Platform", label: "Track Your Collection", href: "/how-it-works/track",   enabled: true, order: 60 },
  { key: "footer_platform_sell",    section: "Footer — Platform", label: "Sell on The Exchange",  href: "/how-it-works/sell",    enabled: true, order: 61 },
  { key: "footer_platform_offer",   section: "Footer — Platform", label: "Get a Cash Offer",      href: "/how-it-works/offer",   enabled: true, order: 62 },
  { key: "footer_platform_consign", section: "Footer — Platform", label: "Consign a Card",        href: "/how-it-works/consign", enabled: true, order: 63 },
  { key: "footer_platform_trade",   section: "Footer — Platform", label: "Trade Cards",           href: "/how-it-works/trade",   enabled: true, order: 64 },
  // Footer — Company column
  { key: "footer_company_howto",    section: "Footer — Company",  label: "How It Works", href: "/how-it-works", enabled: true, order: 70 },
  { key: "footer_company_about",    section: "Footer — Company",  label: "About",        href: "/about",        enabled: true, order: 71 },
  { key: "footer_company_pricing",  section: "Footer — Company",  label: "Pricing",      href: "/pricing",      enabled: true, order: 72 },
  { key: "footer_company_support",  section: "Footer — Company",  label: "Support",      href: "/support",      enabled: true, order: 73 },
  { key: "footer_company_contact",  section: "Footer — Company",  label: "Contact",      href: "/contact",      enabled: true, order: 74 },
  // Social media
  { key: "social_instagram", section: "Social Media", label: "Instagram", href: "", enabled: false, order: 50 },
  { key: "social_facebook",  section: "Social Media", label: "Facebook",  href: "", enabled: false, order: 51 },
  { key: "social_x",         section: "Social Media", label: "X (Twitter)", href: "", enabled: false, order: 52 },
  { key: "social_youtube",   section: "Social Media", label: "YouTube",   href: "", enabled: false, order: 53 },
  { key: "social_tiktok",    section: "Social Media", label: "TikTok",    href: "", enabled: false, order: 54 },
  // Dashboard section visibility
  { key: "dashboard_watchlist",     section: "Dashboard Sections", label: "Watchlist Highlights",    href: "#watchlist",    enabled: true, order: 100 },
  { key: "dashboard_following",     section: "Dashboard Sections", label: "Following Feed",          href: "#following",    enabled: true, order: 101 },
  { key: "dashboard_consignments",  section: "Dashboard Sections", label: "Active Consignments",     href: "#consignments", enabled: true, order: 102 },
  { key: "dashboard_featured",      section: "Dashboard Sections", label: "Featured Cards",          href: "#featured",     enabled: true, order: 103 },
];

/** Canonical section display order */
export const SECTION_ORDER = [
  "Navigation", "Service Cards", "Community", "Footer CTA", "Footer Legal",
  "Footer — Platform", "Footer — Company", "Social Media", "Dashboard Sections",
];

/** Load all links from the database. */
export async function getLinksMap(): Promise<LinksMap> {
  const rows = await db.siteLink.findMany({ orderBy: [{ order: "asc" }] });
  const map: LinksMap = {};
  for (const r of rows) {
    map[r.key] = { key: r.key, section: r.section, label: r.label, href: r.href, enabled: r.enabled, order: r.order };
  }
  return map;
}

/** Seed any missing links into the database. Safe to call on every server render. */
export async function seedLinks(): Promise<void> {
  const existing = await db.siteLink.findMany({ select: { key: true } });
  const existingKeys = new Set(existing.map(l => l.key));
  const toCreate = LINK_SEED.filter(l => !existingKeys.has(l.key));
  if (toCreate.length > 0) {
    await db.siteLink.createMany({ data: toCreate });
  }
}
