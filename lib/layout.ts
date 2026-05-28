import { db } from "./db";

// ── Widget registry ───────────────────────────────────────────────────────────
// `pages` lists where a widget lives by default — but any widget can be added
// to any page from Admin → Page Layout. The `pages` array only controls which
// tab a widget is pre-seeded into; it doesn't restrict placement.

export interface WidgetDef {
  key:         string;
  label:       string;
  description: string;
  pages:       string[];
}

export const WIDGET_REGISTRY: Record<string, WidgetDef> = {
  // ── Dashboard ─────────────────────────────────────────────────────────────
  my_feed: {
    key: "my_feed", label: "My Activity",
    description: "Cards you've shared to your public feed, with captions.",
    pages: ["dashboard"],
  },
  welcome_header: {
    key: "welcome_header", label: "Welcome Header",
    description: "Personalized greeting with time of day and quick-action buttons.",
    pages: ["dashboard"],
  },
  portfolio_stats: {
    key: "portfolio_stats", label: "Portfolio Stats",
    description: "Cards tracked, collections, estimated value, and change over time.",
    pages: ["dashboard"],
  },
  my_collections: {
    key: "my_collections", label: "My Collections",
    description: "The user's own collection grid.",
    pages: ["dashboard"],
  },
  watchlist_highlights: {
    key: "watchlist_highlights", label: "Watchlist Highlights",
    description: "Up to 4 watched cards with value change since adding.",
    pages: ["dashboard"],
  },
  following_feed: {
    key: "following_feed", label: "Following Feed",
    description: "Recent public cards added by collectors the user follows.",
    pages: ["dashboard"],
  },
  consignment_status: {
    key: "consignment_status", label: "Active Consignments",
    description: "Open consignment orders and their current status.",
    pages: ["dashboard"],
  },
  // ── Shared ────────────────────────────────────────────────────────────────
  featured_cards: {
    key: "featured_cards", label: "Featured Cards",
    description: "Admin-curated featured public cards from the community.",
    pages: ["dashboard", "explore", "landing"],
  },
  news_strip: {
    key: "news_strip", label: "Latest Articles",
    description: "Most recent published articles from the site.",
    pages: ["dashboard", "explore", "landing"],
  },
  featured_collectors: {
    key: "featured_collectors", label: "Featured Collectors",
    description: "Admin-featured collectors highlighted for the community.",
    pages: ["dashboard", "explore", "landing"],
  },
  // ── Explore ───────────────────────────────────────────────────────────────
  public_collections: {
    key: "public_collections", label: "Public Collections",
    description: "Browse public collections from all collectors.",
    pages: ["explore"],
  },
  // ── Landing page ──────────────────────────────────────────────────────────
  landing_hero: {
    key: "landing_hero", label: "Hero Section",
    description: "Main hero with headline, CTA buttons, and service cards (Track, Sell, Consign, Trade).",
    pages: ["landing"],
  },
  landing_community_pitch: {
    key: "landing_community_pitch", label: "Community Pitch",
    description: "Community section with stats, pillars, and call-to-action.",
    pages: ["landing"],
  },
  landing_community_feed: {
    key: "landing_community_feed", label: "Community Feed",
    description: "Real-time community activity feed.",
    pages: ["landing"],
  },
  landing_recently_added: {
    key: "landing_recently_added", label: "Recently Added",
    description: "Recently added public cards from the community.",
    pages: ["landing"],
  },
  landing_article_strip: {
    key: "landing_article_strip", label: "Article Strip",
    description: "Blog and article links.",
    pages: ["landing"],
  },
  landing_social_feed: {
    key: "landing_social_feed", label: "Social Feed Strip",
    description: "Horizontal scrolling strip of the latest public posts from collectors.",
    pages: ["landing"],
  },
  landing_sports_categories: {
    key: "landing_sports_categories", label: "Sports Categories",
    description: "Baseball, football, basketball, soccer, hockey, Pokémon category showcase strip.",
    pages: ["landing"],
  },
  landing_pricing: {
    key: "landing_pricing", label: "Pricing Section",
    description: "Four-tier pricing summary (Track, Exchange, Consign, Trade) with link to full pricing page.",
    pages: ["landing"],
  },
  landing_footer_cta: {
    key: "landing_footer_cta", label: "Footer CTA",
    description: "Sign up / log in call-to-action section above the footer.",
    pages: ["landing"],
  },
  // ── eBay listing form ─────────────────────────────────────────────────────
  // These only appear on the ebay_listing admin page — not addable to other pages.
  ebay_title: {
    key: "ebay_title", label: "Title & Subtitle",
    description: "Listing title (max 80 chars) and optional subtitle.",
    pages: ["ebay_listing"],
  },
  ebay_description: {
    key: "ebay_description", label: "Description",
    description: "Full listing description shown to buyers on eBay.",
    pages: ["ebay_listing"],
  },
  ebay_pricing: {
    key: "ebay_pricing", label: "Pricing",
    description: "Start price, Buy It Now price, and auction duration.",
    pages: ["ebay_listing"],
  },
  ebay_category: {
    key: "ebay_category", label: "Category",
    description: "eBay leaf category for the listing.",
    pages: ["ebay_listing"],
  },
  ebay_duration: {
    key: "ebay_duration", label: "Auction Duration",
    description: "Duration in days for auction listings (1, 3, 5, 7, or 10).",
    pages: ["ebay_listing"],
  },
  ebay_card_identity: {
    key: "ebay_card_identity", label: "Card Identity",
    description: "Player, card name, card number, set, parallel, manufacturer, year, season.",
    pages: ["ebay_listing"],
  },
  ebay_sport: {
    key: "ebay_sport", label: "Sport",
    description: "Sport (required) — auto-filled from consignment, editable by admin.",
    pages: ["ebay_listing"],
  },
  ebay_team_league: {
    key: "ebay_team_league", label: "Team & League",
    description: "Team name and league (auto-filled from sport).",
    pages: ["ebay_listing"],
  },
  ebay_physical: {
    key: "ebay_physical", label: "Physical Attributes",
    description: "Card thickness, country of origin, language, vintage, customized, original/reprint.",
    pages: ["ebay_listing"],
  },
  ebay_condition: {
    key: "ebay_condition", label: "Condition",
    description: "Graded or ungraded; grader company, grade, cert number, or card condition.",
    pages: ["ebay_listing"],
  },
  ebay_autograph: {
    key: "ebay_autograph", label: "Autograph Details",
    description: "Signed by, authentication, auth number, and autograph format.",
    pages: ["ebay_listing"],
  },
  ebay_shipping: {
    key: "ebay_shipping", label: "Shipping",
    description: "Free shipping toggle.",
    pages: ["ebay_listing"],
  },
  ebay_offers: {
    key: "ebay_offers", label: "Offers",
    description: "Allow offers toggle and minimum offer amount.",
    pages: ["ebay_listing"],
  },
  ebay_compliance: {
    key: "ebay_compliance", label: "UPC & Compliance",
    description: "UPC barcode and California Prop 65 warning.",
    pages: ["ebay_listing"],
  },
  ebay_schedule: {
    key: "ebay_schedule", label: "Schedule Listing",
    description: "Set a future date/time for the listing to go live automatically.",
    pages: ["ebay_listing"],
  },
  ebay_private: {
    key: "ebay_private", label: "Private Listing",
    description: "Hide buyer and bidder information from public view.",
    pages: ["ebay_listing"],
  },
  ebay_custom: {
    key: "ebay_custom", label: "Custom Item Specifics",
    description: "Admin-defined extra key/value pairs sent to eBay.",
    pages: ["ebay_listing"],
  },
};

// ── Default layouts for each page ─────────────────────────────────────────────

const PAGE_DEFAULTS: Record<string, { key: string; order: number }[]> = {
  dashboard: [
    { key: "welcome_header",       order: 1 },
    { key: "portfolio_stats",      order: 2 },
    { key: "my_collections",       order: 3 },
    { key: "my_feed",              order: 4 },
    { key: "watchlist_highlights", order: 5 },
    { key: "following_feed",       order: 6 },
    { key: "consignment_status",   order: 7 },
    { key: "featured_cards",       order: 8 },
    { key: "news_strip",           order: 9 },
    { key: "featured_collectors",  order: 10 },
  ],
  explore: [
    { key: "featured_collectors",  order: 1 },
    { key: "public_collections",   order: 2 },
    { key: "featured_cards",       order: 3 },
    { key: "news_strip",           order: 4 },
  ],
  landing: [
    { key: "landing_hero",               order: 1 },
    { key: "landing_sports_categories", order: 2 },
    { key: "featured_cards",            order: 3 },
    { key: "landing_community_pitch",   order: 4 },
    { key: "landing_pricing",           order: 5 },
    { key: "landing_community_feed",   order: 6 },
    { key: "landing_recently_added",   order: 7 },
    { key: "landing_social_feed",      order: 8 },
    { key: "landing_article_strip",    order: 9 },
    { key: "news_strip",               order: 10 },
    { key: "landing_footer_cta",       order: 11 },
  ],
  ebay_listing: [
    { key: "ebay_title",         order: 1  },
    { key: "ebay_description",   order: 2  },
    { key: "ebay_pricing",       order: 3  },
    { key: "ebay_offers",        order: 4  },
    { key: "ebay_category",      order: 5  },
    { key: "ebay_duration",      order: 6  },
    { key: "ebay_card_identity", order: 7  },
    { key: "ebay_sport",         order: 8  },
    { key: "ebay_team_league",   order: 9  },
    { key: "ebay_physical",      order: 10 },
    { key: "ebay_condition",     order: 11 },
    { key: "ebay_autograph",     order: 12 },
    { key: "ebay_shipping",      order: 13 },
    { key: "ebay_compliance",    order: 14 },
    { key: "ebay_schedule",      order: 15 },
    { key: "ebay_private",       order: 16 },
    { key: "ebay_custom",        order: 17 },
  ],
};

// ── Public API ─────────────────────────────────────────────────────────────────

export interface PageWidgetConfig {
  id:          string;
  widgetKey:   string;
  order:       number;
  enabled:     boolean;
  label:       string;
  description: string;
}

export async function getPageLayout(page: string): Promise<PageWidgetConfig[]> {
  await seedPageLayout(page);
  const rows = await db.pageLayout.findMany({
    where:   { page },
    orderBy: { order: "asc" },
  });
  return rows
    .filter(r => WIDGET_REGISTRY[r.widgetKey])
    .map(r => ({
      id:          r.id,
      widgetKey:   r.widgetKey,
      order:       r.order,
      enabled:     r.enabled,
      label:       WIDGET_REGISTRY[r.widgetKey].label,
      description: WIDGET_REGISTRY[r.widgetKey].description,
    }));
}

export async function seedPageLayout(page: string): Promise<void> {
  const defaults = PAGE_DEFAULTS[page];
  if (!defaults) return;
  const existing = await db.pageLayout.findMany({ where: { page }, select: { widgetKey: true } });
  const existingKeys = new Set(existing.map(r => r.widgetKey));
  const toCreate = defaults.filter(d => !existingKeys.has(d.key));
  if (toCreate.length > 0) {
    await db.pageLayout.createMany({
      data: toCreate.map(d => ({ page, widgetKey: d.key, order: d.order, enabled: true })),
    });
  }
}

export function isWidgetEnabled(layout: PageWidgetConfig[], key: string): boolean {
  const w = layout.find(l => l.widgetKey === key);
  return w?.enabled !== false;
}
