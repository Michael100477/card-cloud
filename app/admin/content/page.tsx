import { db } from "@/lib/db";
import { ContentClient } from "./ContentClient";
import { TERMS_DEFAULTS } from "@/lib/terms-defaults";
import { PRIVACY_DEFAULTS } from "@/lib/privacy-defaults";

export const CMS_SLOTS = [
  {
    section: "How It Works — Modal",
    slots: [
      { key: "howto_video_url",      label: "Video embed URL (YouTube: https://www.youtube.com/embed/VIDEO_ID · Vimeo: https://player.vimeo.com/video/VIDEO_ID)", defaultValue: "", multiline: false },
      { key: "howto_modal_title",    label: "Modal title",                   defaultValue: "See how The Card Cloud works",                        multiline: false },
      { key: "howto_modal_body",     label: "Modal subtitle",                defaultValue: "Watch a quick overview, then read the full guide.",   multiline: false },
      { key: "howto_modal_cta",      label: "Link to full guide — text",     defaultValue: "Read the full how-to guide",                         multiline: false },
    ],
  },
  {
    section: "How To — Main page",
    slots: [
      { key: "howto_page_title",    label: "Page headline", defaultValue: "How The Card Cloud Works",                                                   multiline: false },
      { key: "howto_page_subtitle", label: "Page subtitle", defaultValue: "Everything you need to know — from tracking your first card to getting paid.", multiline: false },
      { key: "howto_page_blocks",   label: "Page content",  defaultValue: "[]",                                                                            multiline: false, type: "blocks" },
    ],
  },
  {
    section: "How To — Track",
    slots: [
      { key: "howto_track_title",    label: "Page title",      defaultValue: "How tracking works",      multiline: false },
      { key: "howto_track_subtitle", label: "Page subtitle",   defaultValue: "",                        multiline: false },
      { key: "howto_track_cta",      label: "CTA button text", defaultValue: "Start tracking free",     multiline: false },
      { key: "howto_track_cta_url",  label: "CTA button URL",  defaultValue: "/signup",                 multiline: false, type: "url" },
      { key: "howto_track_blocks",   label: "Page content",    defaultValue: "[]",                      multiline: false, type: "blocks" },
    ],
  },
  {
    section: "How To — Sell on The Exchange",
    slots: [
      { key: "howto_sell_title",    label: "Page title",      defaultValue: "How selling on The Exchange works", multiline: false },
      { key: "howto_sell_subtitle", label: "Page subtitle",   defaultValue: "",                                   multiline: false },
      { key: "howto_sell_cta",      label: "CTA button text", defaultValue: "List a card",                        multiline: false },
      { key: "howto_sell_cta_url",  label: "CTA button URL",  defaultValue: "/exchange/sell",                     multiline: false, type: "url" },
      { key: "howto_sell_blocks",   label: "Page content",    defaultValue: "[]",                                 multiline: false, type: "blocks" },
    ],
  },
  {
    section: "How To — Get an Offer",
    slots: [
      { key: "howto_offer_title",    label: "Page title",      defaultValue: "How getting a cash offer works", multiline: false },
      { key: "howto_offer_subtitle", label: "Page subtitle",   defaultValue: "",                               multiline: false },
      { key: "howto_offer_cta",      label: "CTA button text", defaultValue: "Get an offer",                   multiline: false },
      { key: "howto_offer_cta_url",  label: "CTA button URL",  defaultValue: "/signup",                        multiline: false, type: "url" },
      { key: "howto_offer_blocks",   label: "Page content",    defaultValue: "[]",                             multiline: false, type: "blocks" },
    ],
  },
  {
    section: "How To — Consign",
    slots: [
      { key: "howto_consign_title",    label: "Page title",      defaultValue: "How consigning works", multiline: false },
      { key: "howto_consign_subtitle", label: "Page subtitle",   defaultValue: "",                     multiline: false },
      { key: "howto_consign_cta",      label: "CTA button text", defaultValue: "Consign a card",       multiline: false },
      { key: "howto_consign_cta_url",  label: "CTA button URL",  defaultValue: "/dashboard/consign",   multiline: false, type: "url" },
      { key: "howto_consign_blocks",   label: "Page content",    defaultValue: "[]",                   multiline: false, type: "blocks" },
    ],
  },
  {
    section: "How To — Trade",
    slots: [
      { key: "howto_trade_title",    label: "Page title",      defaultValue: "How trading works",       multiline: false },
      { key: "howto_trade_subtitle", label: "Page subtitle",   defaultValue: "",                        multiline: false },
      { key: "howto_trade_cta",      label: "CTA button text", defaultValue: "Browse trades",           multiline: false },
      { key: "howto_trade_cta_url",  label: "CTA button URL",  defaultValue: "/signup",                 multiline: false, type: "url" },
      { key: "howto_trade_blocks",   label: "Page content",    defaultValue: "[]",                      multiline: false, type: "blocks" },
    ],
  },
  {
    section: "Hero",
    slots: [
      { key: "hero_kicker",            label: "Kicker (small text above headline)", defaultValue: "Sports · Pokémon · Magic · All cards",   multiline: false, type: "stat-row", showKey: "hero_kicker_show",            showDefault: "yes" },
      { key: "hero_headline",          label: "Headline",                            defaultValue: "The smartest home for your card collection.", multiline: false, type: "stat-row", showKey: "hero_headline_show",          showDefault: "yes" },
      { key: "hero_body",              label: "Body paragraph",                      defaultValue: "Track your collection with live eBay values, sell or consign with ease, trade safely — and share every pickup with a community of collectors who actually get it.", multiline: true, type: "stat-row", showKey: "hero_body_show", showDefault: "yes" },
      { key: "hero_cta_primary",       label: "Primary CTA — button text",           defaultValue: "Sign up free",        multiline: false, type: "stat-row", showKey: "hero_cta_primary_show",       showDefault: "yes" },
      { key: "hero_cta_primary_url",   label: "Primary CTA — URL",                   defaultValue: "/signup",             multiline: false, type: "url" },
      { key: "hero_cta_secondary",     label: "Secondary CTA — button text",         defaultValue: "See how it works",    multiline: false, type: "stat-row", showKey: "hero_cta_secondary_show",     showDefault: "yes" },
      { key: "hero_cta_secondary_url", label: "Secondary CTA — URL",                 defaultValue: "#services",           multiline: false, type: "url" },
    ],
  },
  {
    section: "Service card — Track",
    slots: [
      { key: "service_track_name",        label: "Card title",    defaultValue: "Track",                          multiline: false, type: "stat-row", showKey: "service_track_name_show",    showDefault: "yes" },
      { key: "service_track_tagline",     label: "Tagline",       defaultValue: "Catalog & monitor values",       multiline: false, type: "stat-row", showKey: "service_track_tagline_show", showDefault: "yes" },
      { key: "service_track_description", label: "Description",   defaultValue: "Free collection tracking with live eBay values, trend charts, and smart organization tools.", multiline: true, type: "stat-row", showKey: "service_track_description_show", showDefault: "yes" },
      { key: "service_track_pricing",     label: "Pricing headline — use %FreeCards% to insert the free card limit from Settings → Rates", defaultValue: "Free up to %FreeCards% cards", multiline: false, type: "stat-row", showKey: "service_track_pricing_show", showDefault: "yes" },
    ],
  },
  {
    section: "Service card — Sell",
    slots: [
      { key: "service_sell_name",        label: "Card title",  defaultValue: "Sell",                           multiline: false, type: "stat-row", showKey: "service_sell_name_show",        showDefault: "yes" },
      { key: "service_sell_tagline",     label: "Tagline",     defaultValue: "List on The Exchange",           multiline: false, type: "stat-row", showKey: "service_sell_tagline_show",     showDefault: "yes" },
      { key: "service_sell_description", label: "Description", defaultValue: "Set your price and list your card directly on The Exchange. We hold payment in escrow and release it once your buyer confirms receipt.", multiline: true, type: "stat-row", showKey: "service_sell_description_show", showDefault: "yes" },
    ],
  },
  {
    section: "Service card — Get an Offer",
    slots: [
      { key: "service_offer_name",           label: "Card title",    defaultValue: "Get an Offer",     multiline: false, type: "stat-row", showKey: "service_offer_name_show",           showDefault: "yes" },
      { key: "service_offer_tagline",        label: "Tagline",       defaultValue: "Fast cash offer",  multiline: false, type: "stat-row", showKey: "service_offer_tagline_show",        showDefault: "yes" },
      { key: "service_offer_description",    label: "Description",   defaultValue: "Submit a card and get a personal cash offer within 24–48 hours. Accept and we handle shipping and payout.", multiline: true, type: "stat-row", showKey: "service_offer_description_show", showDefault: "yes" },
      { key: "service_offer_pricing",        label: "Pricing headline",   defaultValue: "No fee to you",                           multiline: false, type: "stat-row", showKey: "service_offer_pricing_show",        showDefault: "yes" },
      { key: "service_offer_pricing_detail", label: "Pricing detail",     defaultValue: "We research comps and make you an offer", multiline: false, type: "stat-row", showKey: "service_offer_pricing_detail_show", showDefault: "yes" },
    ],
  },
  {
    section: "Service card — Consign",
    slots: [
      { key: "service_consign_name",        label: "Card title",  defaultValue: "Consign",              multiline: false, type: "stat-row", showKey: "service_consign_name_show",        showDefault: "yes" },
      { key: "service_consign_tagline",     label: "Tagline",     defaultValue: "Maximize sale price",  multiline: false, type: "stat-row", showKey: "service_consign_tagline_show",     showDefault: "yes" },
      { key: "service_consign_description", label: "Description", defaultValue: "We list on eBay and pay you when it sells. All listing and eBay fees are included in our commission.", multiline: true, type: "stat-row", showKey: "service_consign_description_show", showDefault: "yes" },
    ],
  },
  {
    section: "Service card — Trade",
    slots: [
      { key: "service_trade_name",        label: "Card title",  defaultValue: "Trade",             multiline: false, type: "stat-row", showKey: "service_trade_name_show",    showDefault: "yes" },
      { key: "service_trade_tagline",     label: "Tagline",     defaultValue: "Swap cards safely", multiline: false, type: "stat-row", showKey: "service_trade_tagline_show", showDefault: "yes" },
      { key: "service_trade_description", label: "Description", defaultValue: "We act as escrow. Both collectors ship to us; we verify condition and re-ship to the new owner.", multiline: true, type: "stat-row", showKey: "service_trade_description_show", showDefault: "yes" },
      { key: "service_trade_pricing",     label: "Pricing headline — use %CostPerSide%, %ServiceFee%, %ShippingFee% from Settings → Rates", defaultValue: "%CostPerSide% per side", multiline: false, type: "stat-row", showKey: "service_trade_pricing_show", showDefault: "yes" },
    ],
  },
  {
    section: "Community section",
    slots: [
      { key: "community_kicker",      label: "Section kicker",  defaultValue: "Community",                    multiline: false, type: "stat-row", showKey: "community_kicker_show",      showDefault: "yes" },
      { key: "community_headline",    label: "Headline line 1", defaultValue: "More than a tracker.",         multiline: false, type: "stat-row", showKey: "community_headline_show",    showDefault: "yes" },
      { key: "community_subheadline", label: "Headline line 2", defaultValue: "A home for collectors.",       multiline: false, type: "stat-row", showKey: "community_subheadline_show", showDefault: "yes" },
      { key: "community_body",        label: "Body paragraph",  defaultValue: "The Card Cloud isn't just a tool for managing cards — it's where collectors gather. Show off what you've built, celebrate other people's pickups, and find your people in the hobby.", multiline: true, type: "stat-row", showKey: "community_body_show", showDefault: "yes" },
      { key: "community_cta_primary",     label: "Primary CTA — button text", defaultValue: "Create your collection", multiline: false, type: "stat-row", showKey: "community_cta_primary_show", showDefault: "yes" },
      { key: "community_cta_primary_url", label: "Primary CTA — URL",         defaultValue: "/signup",               multiline: false, type: "url" },
    ],
  },
  {
    section: "Community section — Pillar 1",
    slots: [
      { key: "community_pillar1_headline", label: "Headline", defaultValue: "Show off every pull", multiline: false, type: "stat-row", showKey: "community_pillar1_headline_show", showDefault: "yes" },
      { key: "community_pillar1_body",     label: "Body",     defaultValue: "Every card you add gets its own page. Your entire collection lives at a public link you can share anywhere — or keep private. When you land a grail, you'll have somewhere worthy to put it.", multiline: true, type: "stat-row", showKey: "community_pillar1_body_show", showDefault: "yes" },
    ],
  },
  {
    section: "Community section — Pillar 2",
    slots: [
      { key: "community_pillar2_headline", label: "Headline", defaultValue: "Reactions from people who get it", multiline: false, type: "stat-row", showKey: "community_pillar2_headline_show", showDefault: "yes" },
      { key: "community_pillar2_body",     label: "Body",     defaultValue: "Comments and likes from collectors who actually understand the hobby. When you post a PSA 10 or a vintage holo, the people celebrating with you will know exactly why it matters.", multiline: true, type: "stat-row", showKey: "community_pillar2_body_show", showDefault: "yes" },
    ],
  },
  {
    section: "Community section — Pillar 3",
    slots: [
      { key: "community_pillar3_headline", label: "Headline", defaultValue: "Follow the collectors you admire", multiline: false, type: "stat-row", showKey: "community_pillar3_headline_show", showDefault: "yes" },
      { key: "community_pillar3_body",     label: "Body",     defaultValue: "Discover collections by sport, era, team, or player. Follow the hunters whose taste matches yours and see every new pickup in your personal feed the moment it's added.", multiline: true, type: "stat-row", showKey: "community_pillar3_body_show", showDefault: "yes" },
    ],
  },
  {
    section: "Pricing section (landing page)",
    slots: [
      { key: "pricing_kicker",   label: "Section kicker",    defaultValue: "Pricing",                                                             multiline: false },
      { key: "pricing_headline", label: "Headline",          defaultValue: "Simple, transparent pricing",                                         multiline: false },
      { key: "pricing_subtitle", label: "Subtitle",          defaultValue: "Free to start. Pay only when we help you sell or trade.",              multiline: false },
      { key: "pricing_cta",      label: "CTA button text",   defaultValue: "See full pricing details",                                            multiline: false },
      { key: "pricing_cta_url",  label: "CTA button URL",    defaultValue: "/pricing",                                                            multiline: false, type: "url" },
      { key: "pricing_tier_track_name",       label: "Track — tier name",     defaultValue: "Track",                                              multiline: false },
      { key: "pricing_tier_track_price",      label: "Track — price",         defaultValue: "Free",                                               multiline: false },
      { key: "pricing_tier_track_detail",     label: "Track — price detail",  defaultValue: "Up to 100 cards",                                    multiline: false },
      { key: "pricing_tier_track_body",       label: "Track — description",   defaultValue: "Catalog your collection with live eBay value estimates and smart organization tools.", multiline: true },
      { key: "pricing_tier_exchange_name",    label: "Exchange — tier name",  defaultValue: "The Exchange",                                       multiline: false },
      { key: "pricing_tier_exchange_price",   label: "Exchange — price",      defaultValue: "7%",                                                 multiline: false },
      { key: "pricing_tier_exchange_detail",  label: "Exchange — price detail", defaultValue: "of sale price",                                    multiline: false },
      { key: "pricing_tier_exchange_body",    label: "Exchange — description", defaultValue: "List your card to other collectors. Payment held in escrow until delivery is confirmed.", multiline: true },
      { key: "pricing_tier_consign_name",     label: "Consign — tier name",   defaultValue: "Consign",                                            multiline: false },
      { key: "pricing_tier_consign_price",    label: "Consign — price",       defaultValue: "15%",                                                multiline: false },
      { key: "pricing_tier_consign_detail",   label: "Consign — price detail", defaultValue: "commission on sale",                                multiline: false },
      { key: "pricing_tier_consign_body",     label: "Consign — description", defaultValue: "We photograph, list on eBay, and ship for you. All fees included in our commission.", multiline: true },
      { key: "pricing_tier_trade_name",       label: "Trade — tier name",     defaultValue: "Trade",                                              multiline: false },
      { key: "pricing_tier_trade_price",      label: "Trade — price",         defaultValue: "$17/side",                                           multiline: false },
      { key: "pricing_tier_trade_detail",     label: "Trade — price detail",  defaultValue: "+ $7 shipping",                                      multiline: false },
      { key: "pricing_tier_trade_body",       label: "Trade — description",   defaultValue: "We act as escrow — verify condition and re-ship to both collectors.",                   multiline: true },
    ],
  },
  {
    section: "Pricing page",
    slots: [
      { key: "pricing_page_headline",          label: "Page headline",             defaultValue: "Simple, transparent pricing",                                         multiline: false },
      { key: "pricing_page_subtitle",          label: "Page subtitle",             defaultValue: "No hidden fees. Pay only when we help you sell or trade.",             multiline: false },
      { key: "pricing_page_callout_headline",  label: "Bottom callout headline",   defaultValue: "Have questions about pricing?",                                       multiline: false },
      { key: "pricing_page_callout_body",      label: "Bottom callout body",       defaultValue: "We're happy to walk you through how any service works before you commit.", multiline: false },
    ],
  },
  {
    section: "Privacy Policy page",
    slots: [
      { key: "privacy_headline",       label: "Page headline",              defaultValue: "Privacy Policy",                                                               multiline: false },
      { key: "privacy_intro",          label: "Intro paragraph (optional)", defaultValue: "",                                                                              multiline: true  },
      { key: "privacy_effective_date", label: "Effective date",             defaultValue: "May 19, 2026",                                                                 multiline: false },
      { key: "privacy_sections",       label: "Policy sections (title + body)", defaultValue: "[]",                                                                       multiline: false, type: "privacy-sections" },
      { key: "privacy_footer_note",    label: "Footer note text",           defaultValue: "Last updated: May 19, 2026 · The Card Cloud · thecardcloud.com",              multiline: false },
    ],
  },
  {
    section: "Terms of Service page",
    slots: [
      { key: "terms_headline",       label: "Page headline",                   defaultValue: "Terms of Service",                                                            multiline: false },
      { key: "terms_intro",          label: "Intro paragraph (optional)",      defaultValue: "",                                                                             multiline: true  },
      { key: "terms_effective_date", label: "Effective date",                  defaultValue: "May 19, 2026",                                                                multiline: false },
      { key: "terms_sections",       label: "Terms sections (title + body)",   defaultValue: "[]",                                                                           multiline: false, type: "terms-sections" },
      { key: "terms_footer_note",    label: "Footer note text",                defaultValue: "Last updated: May 19, 2026 · These terms apply to all users of The Card Cloud.", multiline: false },
    ],
  },
  {
    section: "Support page",
    slots: [
      { key: "support_headline",       label: "Headline",                         defaultValue: "We're here to help",                                                                      multiline: false },
      { key: "support_subtitle",       label: "Subtitle",                         defaultValue: "Find answers in our guides, or reach out to the team directly.",                          multiline: false },
      { key: "support_contact_title",  label: "Contact card — title",             defaultValue: "Contact support",                                                                         multiline: false },
      { key: "support_contact_body",   label: "Contact card — body",              defaultValue: "Have a question, bug report, or need help with your account? Send us a message and we'll get back to you within 1–2 business days.", multiline: true },
      { key: "support_contact_cta",    label: "Contact card — button text",       defaultValue: "Send a message",                                                                          multiline: false },
      { key: "support_howto_title",    label: "How-To card — title",              defaultValue: "How-To guides",                                                                           multiline: false },
      { key: "support_howto_body",     label: "How-To card — body",               defaultValue: "Step-by-step walkthroughs for every feature — from adding your first card to listing on The Exchange.", multiline: true },
      { key: "support_howto_cta",      label: "How-To card — button text",        defaultValue: "Browse guides",                                                                           multiline: false },
      { key: "support_faq_title",      label: "FAQ card — title",                 defaultValue: "FAQ",                                                                                     multiline: false },
      { key: "support_faq_body",       label: "FAQ card — body",                  defaultValue: "Quick answers to the most common questions about The Card Cloud.",                        multiline: true },
      { key: "support_faq_cta",        label: "FAQ card — button text",           defaultValue: "View FAQ",                                                                                multiline: false },
      { key: "support_extra_body",     label: "Extra body text (optional, blank paragraphs = new block)", defaultValue: "",                                                                multiline: true },
    ],
  },
  {
    section: "FAQ page",
    slots: [
      { key: "faq_headline",                  label: "Headline",                              defaultValue: "Frequently Asked Questions",                               multiline: false },
      { key: "faq_subtitle",                  label: "Subtitle",                              defaultValue: "Quick answers to the most common questions about The Card Cloud.", multiline: false },
      { key: "faq_items",                     label: "FAQ questions & answers",               defaultValue: "[]",                                                       multiline: false, type: "faq" },
      { key: "faq_still_need_help_headline",  label: "\"Still have a question?\" headline",  defaultValue: "Still have a question?",                                   multiline: false },
      { key: "faq_still_need_help_body",      label: "\"Still have a question?\" body",      defaultValue: "Our support team typically responds within 1–2 business days.", multiline: false },
      { key: "faq_still_need_help_cta",       label: "\"Still have a question?\" button",    defaultValue: "Contact support",                                          multiline: false },
      { key: "faq_extra_body",                label: "Extra body text (optional)",            defaultValue: "",                                                         multiline: true },
    ],
  },
  {
    section: "Community stats",
    slots: [
      { key: "stat_show_stats", label: "Show stats section",                  defaultValue: "yes",                   multiline: false, type: "toggle" },
      { key: "stat_1_label",   label: "Number of Collectors on the site",   defaultValue: "Collectors",            multiline: false, type: "stat-row", showKey: "stat_1_show", showDefault: "yes" },
      { key: "stat_2_label",   label: "Number of Cards Tracked",            defaultValue: "Cards tracked",         multiline: false, type: "stat-row", showKey: "stat_2_show", showDefault: "yes" },
      { key: "stat_3_label",   label: "Number of Public Collections",       defaultValue: "Public collections",    multiline: false, type: "stat-row", showKey: "stat_3_show", showDefault: "yes" },
      { key: "stat_4_label",   label: "Number of States Represented",       defaultValue: "States represented",    multiline: false, type: "stat-row", showKey: "stat_4_show", showDefault: "yes" },
      { key: "stat_5_label",   label: "Number of Countries Represented",    defaultValue: "Countries represented", multiline: false, type: "stat-row", showKey: "stat_5_show", showDefault: "no"  },
    ],
  },
];

export default async function ContentPage() {
  const [stored, sitePages] = await Promise.all([
    db.siteSetting.findMany(),
    db.sitePage.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] }),
  ]);

  const valueMap: Record<string, string> = {};
  for (const s of stored) valueMap[s.key] = s.value;

  // Pre-populate section editors with defaults when nothing has been saved yet
  if (!valueMap["terms_sections"] || valueMap["terms_sections"] === "[]") {
    valueMap["terms_sections"] = JSON.stringify(
      TERMS_DEFAULTS.map((s, i) => ({ id: String(i), title: s.title, body: s.body, show: true }))
    );
  }
  if (!valueMap["privacy_sections"] || valueMap["privacy_sections"] === "[]") {
    valueMap["privacy_sections"] = JSON.stringify(
      PRIVACY_DEFAULTS.map((s, i) => ({ id: String(i), title: s.title, body: s.body, show: true }))
    );
  }

  return <ContentClient sections={CMS_SLOTS} valueMap={valueMap} sitePages={sitePages} />;
}
