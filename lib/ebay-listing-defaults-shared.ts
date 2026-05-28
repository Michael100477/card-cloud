// Browser-safe: types, field configs, keys, and fallbacks. No DB imports.

// ── Field config — single source of truth ────────────────────────────────────
// Every entry here appears on the Listing Defaults settings page automatically.
// Add a field here → settings page picks it up. Remove it → gone from settings.
// Wire the `draftField` into emptyDraft() and the listing form UI separately.

export type FieldType = "text" | "select" | "toggle" | "number-select";

export interface FieldConfig {
  key:          string;         // SiteSetting key (ebay_ld_*)
  draftField:   string;         // matching key in ListingDraft
  label:        string;
  section:      string;         // groups fields on the settings page
  type:         FieldType;
  defaultValue: string | boolean | number;
  options?:     (string | number)[];  // for select / number-select
  hint?:        string;
}

export const FIELD_CONFIGS: FieldConfig[] = [

  // ── Category ──────────────────────────────────────────────────────────────
  {
    key: "ebay_ld_category_id", draftField: "categoryId",
    label: "Default eBay category ID", section: "Category",
    type: "text", defaultValue: "261328",
    hint: "eBay leaf category ID — 261328 = Sports Trading Cards. Use Admin → Page Layout → eBay Listing to browse your categories and find the right ID.",
  },

  // ── Listing type ──────────────────────────────────────────────────────────
  {
    key: "ebay_ld_listing_type", draftField: "listingType",
    label: "Listing type", section: "Listing type",
    type: "select", defaultValue: "auction",
    options: ["auction", "buyitnow"],
  },
  {
    key: "ebay_ld_auction_duration", draftField: "auctionDuration",
    label: "Auction duration (days)", section: "Listing type",
    type: "number-select", defaultValue: 7,
    options: [1, 3, 5, 7, 10],
    hint: "Only used when listing type is Auction.",
  },

  // ── Pricing ───────────────────────────────────────────────────────────────
  {
    key: "ebay_ld_default_start_price", draftField: "defaultStartPrice",
    label: "Default auction start price ($)", section: "Pricing",
    type: "text", defaultValue: "0.99",
    hint: "Pre-fills the Start Price field on new auctions. Per-listing price overrides this.",
  },

  // ── Scheduling ────────────────────────────────────────────────────────────
  {
    key: "ebay_ld_default_scheduled_time", draftField: "defaultScheduledTime",
    label: "Default scheduled start time", section: "Scheduling",
    type: "text", defaultValue: "22:00",
    hint: "24-hour HH:MM (e.g. 22:00 = 10:00 PM). Used when scheduling is toggled on for a new listing.",
  },

  // ── Shipping ──────────────────────────────────────────────────────────────
  {
    key: "ebay_ld_shipping_method", draftField: "shippingMethod",
    label: "Shipping method", section: "Shipping",
    type: "select", defaultValue: "Standard shipping: Small to medium items",
    options: [
      "Standard shipping: Small to medium items",
      "Freight: Oversized items",
      "Local pickup only: Sell to buyers near you",
    ],
  },
  {
    key: "ebay_ld_shipping_cost_type", draftField: "shippingCostType",
    label: "Cost type", section: "Shipping",
    type: "select", defaultValue: "Calculated: Cost varies based on buyer location",
    options: [
      "Flat rate: Same cost regardless of buyer location",
      "Calculated: Cost varies based on buyer location",
    ],
  },
  {
    key: "ebay_ld_free_shipping", draftField: "freeShipping",
    label: "Free shipping", section: "Shipping",
    type: "toggle", defaultValue: true,
    hint: "eBay promotes free shipping listings more prominently.",
  },

  // ── Offers ────────────────────────────────────────────────────────────────
  {
    key: "ebay_ld_allow_offers", draftField: "allowOffers",
    label: "Accept offers", section: "Offers",
    type: "toggle", defaultValue: false,
  },

  // ── Listing options ───────────────────────────────────────────────────────
  {
    key: "ebay_ld_private_listing", draftField: "privateListing",
    label: "Private listing", section: "Listing options",
    type: "toggle", defaultValue: false,
    hint: "Hides buyer and bidder usernames from public view.",
  },

  // ── Condition ─────────────────────────────────────────────────────────────
  {
    key: "ebay_ld_condition_type", draftField: "conditionType",
    label: "Condition type", section: "Condition",
    type: "select", defaultValue: "",
    options: ["", "graded", "ungraded"],
    hint: "Leave blank to auto-detect from the consignment item's graded status.",
  },
  {
    key: "ebay_ld_card_condition", draftField: "cardCondition",
    label: "Card condition (ungraded)", section: "Condition",
    type: "select", defaultValue: "",
    options: [
      "",
      "Near mint or better",
      "Excellent",
      "Very good",
      "Poor",
    ],
    hint: "Only applied when condition type is 'Ungraded'.",
  },

  // ── Card identity ─────────────────────────────────────────────────────────
  {
    key: "ebay_ld_card_type", draftField: "cardType",
    label: "Card type", section: "Card identity",
    type: "text", defaultValue: "Sports Trading Card",
  },
  {
    key: "ebay_ld_parallel", draftField: "parallel",
    label: "Parallel / Variety", section: "Card identity",
    type: "text", defaultValue: "",
    hint: "e.g. [Base], Gold Foil, Refractor.",
  },
  {
    key: "ebay_ld_insert_set", draftField: "insertSet",
    label: "Insert set", section: "Card identity",
    type: "text", defaultValue: "",
  },
  {
    key: "ebay_ld_print_run", draftField: "printRun",
    label: "Print run", section: "Card identity",
    type: "text", defaultValue: "",
  },
  {
    key: "ebay_ld_event_tournament", draftField: "eventTournament",
    label: "Event / Tournament", section: "Card identity",
    type: "text", defaultValue: "",
  },
  {
    key: "ebay_ld_upc", draftField: "upc",
    label: "UPC", section: "Card identity",
    type: "text", defaultValue: "",
  },

  // ── Team & league ─────────────────────────────────────────────────────────
  {
    key: "ebay_ld_team", draftField: "team",
    label: "Team", section: "Team & league",
    type: "text", defaultValue: "",
    hint: "Leave blank to auto-fill from the consignment item.",
  },
  {
    key: "ebay_ld_league", draftField: "league",
    label: "League", section: "Team & league",
    type: "text", defaultValue: "",
    hint: "Leave blank to auto-derive from sport (e.g. Baseball → MLB).",
  },

  // ── Physical ──────────────────────────────────────────────────────────────
  {
    key: "ebay_ld_card_thickness", draftField: "cardThickness",
    label: "Card thickness", section: "Physical",
    type: "select", defaultValue: "35 pt.",
    options: [
      "20 pt.","35 pt.","55 pt.","59 pt.","75 pt.","79 pt.",
      "100 pt.","108 pt.","130 pt.","138 pt.","180 pt.","197 pt.","240 pt.","360 pt.",
    ],
  },
  {
    key: "ebay_ld_material", draftField: "material",
    label: "Material", section: "Physical",
    type: "select", defaultValue: "Card Stock",
    options: ["Aluminum","Card Stock","Metal","Paper","Paperboard","Plastic"],
  },
  {
    key: "ebay_ld_card_size", draftField: "cardSize",
    label: "Card size", section: "Physical",
    type: "select", defaultValue: "Standard",
    options: ["Booklet","Bowman","Japanese","Oversized","Standard","Tall","Tobacco","Widevision"],
  },
  {
    key: "ebay_ld_country", draftField: "countryOfOrigin",
    label: "Country of origin", section: "Physical",
    type: "text", defaultValue: "United States",
  },
  {
    key: "ebay_ld_language", draftField: "language",
    label: "Language", section: "Physical",
    type: "text", defaultValue: "English",
  },
  {
    key: "ebay_ld_original_licensed", draftField: "originalOrLicensed",
    label: "Original or licensed reprint", section: "Physical",
    type: "select", defaultValue: "Original",
    options: ["Original","Licensed Reprint"],
  },
  {
    key: "ebay_ld_vintage", draftField: "vintage",
    label: "Vintage", section: "Physical",
    type: "toggle", defaultValue: false,
  },
  {
    key: "ebay_ld_customized", draftField: "customized",
    label: "Customized", section: "Physical",
    type: "toggle", defaultValue: false,
  },

  // ── Package — graded cards ────────────────────────────────────────────────
  {
    key: "ebay_ld_weight_lbs_graded", draftField: "weightLbsGraded",
    label: "Weight — lbs (graded)", section: "Package size — graded cards",
    type: "text", defaultValue: "0",
  },
  {
    key: "ebay_ld_weight_oz_graded", draftField: "weightOzGraded",
    label: "Weight — oz (graded)", section: "Package size — graded cards",
    type: "text", defaultValue: "3",
  },
  {
    key: "ebay_ld_dim_length_graded", draftField: "dimLengthGraded",
    label: "Length in. (graded)", section: "Package size — graded cards",
    type: "text", defaultValue: "11.0",
  },
  {
    key: "ebay_ld_dim_width_graded", draftField: "dimWidthGraded",
    label: "Width in. (graded)", section: "Package size — graded cards",
    type: "text", defaultValue: "6.0",
  },
  {
    key: "ebay_ld_dim_height_graded", draftField: "dimHeightGraded",
    label: "Height in. (graded)", section: "Package size — graded cards",
    type: "text", defaultValue: "1.0",
  },

  // ── Package — ungraded cards ──────────────────────────────────────────────
  {
    key: "ebay_ld_weight_lbs_ungraded", draftField: "weightLbsUngraded",
    label: "Weight — lbs (ungraded)", section: "Package size — ungraded cards",
    type: "text", defaultValue: "0",
  },
  {
    key: "ebay_ld_weight_oz_ungraded", draftField: "weightOzUngraded",
    label: "Weight — oz (ungraded)", section: "Package size — ungraded cards",
    type: "text", defaultValue: "1",
  },
  {
    key: "ebay_ld_dim_length_ungraded", draftField: "dimLengthUngraded",
    label: "Length in. (ungraded)", section: "Package size — ungraded cards",
    type: "text", defaultValue: "10.0",
  },
  {
    key: "ebay_ld_dim_width_ungraded", draftField: "dimWidthUngraded",
    label: "Width in. (ungraded)", section: "Package size — ungraded cards",
    type: "text", defaultValue: "4.0",
  },
  {
    key: "ebay_ld_dim_height_ungraded", draftField: "dimHeightUngraded",
    label: "Height in. (ungraded)", section: "Package size — ungraded cards",
    type: "text", defaultValue: "1.0",
  },

  // ── UPC & compliance ──────────────────────────────────────────────────────
  {
    key: "ebay_ld_california_prop65", draftField: "californiaProp65",
    label: "California Prop 65 warning", section: "UPC & compliance",
    type: "text", defaultValue: "",
  },

  // ── Autograph ─────────────────────────────────────────────────────────────
  {
    key: "ebay_ld_autographed", draftField: "autographedEbay",
    label: "Autographed", section: "Autograph",
    type: "toggle", defaultValue: false,
    hint: "Auto-filled from the consignment form; this default is used as a fallback.",
  },
];

// ── Derived keys, fallbacks, and interface ───────────────────────────────────

export const EBAY_LD_KEYS = Object.fromEntries(
  FIELD_CONFIGS.map(f => [f.draftField, f.key])
) as Record<string, string>;

export type EbayListingDefaults = Record<string, string | boolean | number>;

export const EBAY_LD_FALLBACKS: EbayListingDefaults = Object.fromEntries(
  FIELD_CONFIGS.map(f => [f.draftField, f.defaultValue])
);
