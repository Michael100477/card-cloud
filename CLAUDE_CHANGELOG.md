# Claude Changelog

One entry per completed task. Written immediately after the task is done.
Format: `## YYYY-MM-DD HH:MM — Task title`

---

## 2026-05-28 — Trading Phase 3: email notifications + dispute flag

**Email provider clarification:** Mike confirmed Card Cloud sends email via SMTP through `sendTransactionalEmail()` in `lib/transactional-email.ts` (nodemailer + admin-configured SMTP credentials). Resend is just a fallback. Saved as a feedback memory so I don't drift back to mentioning Resend.

**Email templates added to `lib/transactional-email.ts`** (matching the existing `consignmentReceivedHtml` style — navy header, white body, #EF9F27 button):
- `tradeProposalReceivedHtml` — new proposal arrives
- `tradeCounterOfferHtml` — counter from the other side
- `tradeAcceptedHtml` — both accepted, with "what happens next" instructions
- `tradeDeclinedHtml` — declined
- `tradeReceivedByCardCloudHtml` — Card Cloud received one side's shipment (different framing for sender vs other party)
- `tradeShippedFromCardCloudHtml` — outbound shipment with tracking number
- `tradeCompleteHtml` — both sides confirmed receipt
- `tradeDisputeOpenedHtml` — dispute filed

**Trigger helpers (`lib/trade-emails.ts`):** centralizes the "fetch trade context + send the right template per recipient" logic. Each helper is fire-and-forget via `void emailX(id)` so it never blocks the API response. Catches its own errors and console.error's them.

**Wired into every status-change route:**
- `POST /api/trades` → `emailProposalCreated` (target gets the proposal)
- `POST /api/trades/[id]/accept` → `emailAccepted` (both parties get shipping instructions)
- `POST /api/trades/[id]/decline` → `emailDeclined` (proposer notified)
- `POST /api/trades/[id]/counter` → `emailCounterOffer` (other side gets the counter)
- `POST /api/trades/[id]/confirm-received` → `emailComplete` ONLY when both have confirmed (transitions to "complete")
- `POST /api/admin/trades/[id]/mark-inbound-received` → `emailInboundReceived` (both parties get update)
- `POST /api/admin/trades/[id]/mark-outbound-shipped` → `emailOutboundShipped` (recipient of that shipment notified with tracking)

**Dispute flag:**
- `POST /api/trades/[id]/dispute` — receiver posts `{ reason }`. Only available once `*OutboundShippedAt` is set on the disputer's side AND they haven't already confirmed receipt. Status flips to `disputed`, `disputeOpenedById/Reason/OpenedAt` populated.
- Email goes to BOTH parties (different framing) AND the `ADMIN_EMAIL` env var if set.
- Trade detail page: red banner shown when `status === "disputed"` with reason. "🚩 Report a problem" button appears under the shipment section once Card Cloud has shipped to the user but before they confirm receipt.
- Admin trade detail page: bold red "Dispute open — admin review needed" banner with the reason + who opened it + opened-at timestamp. Note in banner explains resolution is handled outside the platform for now (admin needs to manually flip status once resolved).

**Schema fields used (already in Phase 1 schema):** `disputeOpenedById`, `disputeReason`, `disputeOpenedAt`.

**Files changed:**
- New: `lib/trade-emails.ts`, `app/api/trades/[id]/dispute/route.ts`
- Modified: `lib/transactional-email.ts` (8 new templates), `app/api/trades/route.ts`, `app/api/trades/[id]/{accept,decline,counter,confirm-received}/route.ts`, `app/api/admin/trades/[id]/{mark-inbound-received,mark-outbound-shipped}/route.ts`, `app/trades/[id]/page.tsx` (serialize dispute fields), `app/trades/[id]/TradeDetailClient.tsx` (dispute banner + button), `app/admin/trades/[id]/AdminTradeClient.tsx` (admin dispute banner)

---

## 2026-05-28 — Trading Phase 2: packing slip + QR scan + inbound/outbound tracking + receipt confirmation

**Settings → Rates → Trade escrow shipping address:** new section to enter the Card Cloud return address (name, street, city, state, ZIP) that appears on every packing slip. Stored under `trade_ship_*` setting keys.

**Trader-facing UI changes:**

- `app/trades/[id]/packing-slip/page.tsx` — printable packing slip page. Pulls Card Cloud's return address from settings, lists the cards in the trader's shipment (their side of the current revision), and embeds a QR code (via `qrcode` npm package) that links to `/admin/trades/{id}/receive?side={initiator|target}`. Print CSS hides chrome on print. Auto-generates a fresh QR on every load.
- Trade detail page gets a new `ShipmentSection` (replaces the "next steps" placeholder) shown for statuses `accepted | inbound | received_both | outbound`. Four cards:
  1. Your shipment to Card Cloud — print packing slip + enter inbound tracking
  2. Their shipment to Card Cloud — shows tracking + received status
  3. Card Cloud → you — shows outbound tracking + "Confirm received" button
  4. Card Cloud → them — read-only status
- `Trade` interface in `TradeDetailClient` extended with all inbound/outbound tracking + receipt fields.

**Admin-facing UI:**

- New `/admin/trades` page in sidebar (🔄 icon) — list grouped by Need Attention / In Progress / Finished. Click a row → admin trade detail.
- New `/admin/trades/[id]/page.tsx` (the QR scan target) — shows both sides side-by-side. The `?side=initiator|target` query (set by the QR code on the packing slip) highlights that side with a purple border + "QR target" badge so the admin knows which package they're looking at. Per side:
  - List of cards in that incoming shipment
  - Inbound section with the trader's tracking number + "Mark this side received" button
  - Outbound section that lights up once both inbound shipments arrive — admin enters a tracking number and clicks "Mark shipped"

**API routes added:**
- `POST /api/trades/[id]/inbound-tracking` — trader posts their tracking number, status flips accepted → inbound
- `POST /api/trades/[id]/confirm-received` — trader confirms outbound receipt; when BOTH sides confirm, status flips outbound → complete
- `POST /api/admin/trades/[id]/mark-inbound-received` — admin marks a side's inbound shipment received; when both received, status flips → received_both
- `POST /api/admin/trades/[id]/mark-outbound-shipped` — admin enters outbound tracking + flips status received_both → outbound (or stays outbound if only one side shipped)

**Status flow now wired end-to-end:**
`proposed → counter? → accepted → inbound → received_both → outbound → complete`
With `cancelled / declined / disputed` as off-ramps.

**Files changed:**
- New: `app/trades/[id]/packing-slip/page.tsx`, `app/admin/trades/page.tsx`, `app/admin/trades/[id]/page.tsx`, `app/admin/trades/[id]/AdminTradeClient.tsx`, `app/api/trades/[id]/inbound-tracking/route.ts`, `app/api/trades/[id]/confirm-received/route.ts`, `app/api/admin/trades/[id]/mark-inbound-received/route.ts`, `app/api/admin/trades/[id]/mark-outbound-shipped/route.ts`
- Modified: `app/admin/settings/page.tsx` + `SettingsTabs.tsx` + `SettingsClient.tsx`, `app/admin/layout.tsx`, `app/trades/[id]/TradeDetailClient.tsx`
- Installed: `qrcode` + `@types/qrcode`

---

## 2026-05-28 — Trading Phase 1: schema + mark-tradeable + browse + propose + my trades + accept/decline/counter

**Request:** Build user-to-user trading with Card Cloud as escrow. Users mark cards as tradeable, other users propose offers, both sides can counter-negotiate, eventually both accept and ship cards to Card Cloud, which forwards to the other party.

Confirmed scope decisions:
- Counter-offers are allowed (full negotiation, not just accept/reject)
- Cards lock as soon as they're in any proposal
- Card Cloud acts as escrow — traders ship to Card Cloud, Card Cloud forwards to the other party
- Both sides confirm receipt for completion
- Tracking number capture, email notifications, dispute flag all v1

**Phase 1 shipped today** (foundation: data model + negotiation flow):

Schema (`prisma/schema.prisma`):
- `Card.isTradeable: Boolean` + index
- New `Trade`, `TradeRevision`, `TradeRevisionCard` models with full status flow: `proposed → counter → accepted → inbound → received_both → outbound → complete` (or `declined / cancelled / disputed` exits)
- `Trade` carries inbound + outbound tracking numbers, label URLs, receipt-confirmation timestamps, dispute fields (used in Phase 2/3)
- Three new User back-relations: `initiatedTrades`, `receivedTrades`, `tradeRevisions`

Helper (`lib/trades.ts`):
- `getLockedCardIds()` — returns the set of cards currently locked in any open trade's current revision
- `assertCardsAreUnlocked()` — throws if any card is already in an open trade
- `PATCH /api/cards/[id]` rejects un-marking-tradeable when card is in an open trade

UI:
- `components/cards/TradeToggleButton.tsx` replaces the stub Trade button on the card detail page. Shows filled purple "Open to trade ✓" when active, outline otherwise.
- `/trades` — browse other users' tradeable cards (filters out locked ones); each card links to propose
- `/trades/propose/[cardId]` — pick from your tradeable cards to offer, optional message, send
- `/trades/my` — list all trades I've initiated or received with status badges and card thumbnails
- `/trades/[id]` — detail view showing current offer on the table, message, accept / counter / decline / cancel actions, full revision history. Counter-offer UI lets you pick from your cards + restrict to the cards the other party already put on the table on their side (no expanding the request)

API routes:
- `POST /api/trades` — create proposal
- `POST /api/trades/[id]/accept` — accept current revision (must NOT be the one who proposed it)
- `POST /api/trades/[id]/decline` — decline outright (must NOT be the proposer)
- `POST /api/trades/[id]/cancel` — pull back your own pending proposal
- `POST /api/trades/[id]/counter` — create new revision; you can only request from cards the other side already put on the table on their side, and only add cards from YOUR tradeable pool on your side

**Deferred:**
- Phase 2 (next): packing slip + QR code on the slip + Card Cloud admin scan-to-verify + inbound/outbound tracking entry + both-side receipt confirmation
- Phase 3 (later): email notifications at each status change (Resend) + dispute flag

**Files changed:** new — `lib/trades.ts`, `components/cards/TradeToggleButton.tsx`, `app/trades/page.tsx`, `app/trades/my/page.tsx`, `app/trades/propose/[cardId]/page.tsx`, `app/trades/propose/[cardId]/ProposeTradeClient.tsx`, `app/trades/[id]/page.tsx`, `app/trades/[id]/TradeDetailClient.tsx`, `app/api/trades/route.ts`, `app/api/trades/[id]/accept/route.ts`, `app/api/trades/[id]/decline/route.ts`, `app/api/trades/[id]/cancel/route.ts`, `app/api/trades/[id]/counter/route.ts`. Modified — `prisma/schema.prisma`, `app/api/cards/[id]/route.ts`, `app/dashboard/cards/[id]/page.tsx`

---

## 2026-05-27 — Shipping workflow: Waiting for Payment tab + Shipping page + eBay labels

**Request:** Once auctions or BIN listings sell, paid items should flow into a Shipping section. Sold-but-unpaid items belong in a separate "Waiting for payment" tab. Card Cloud should create the shipping label via eBay (preferring eBay Standard Envelope when eligible) with package size auto-pulled from the listing.

**Schema changes (`prisma/schema.prisma`):** Both `InternalListing` and `EbayListing` get new fields: `ebayOrderId`, `paidAt`, `buyerName`, `buyerAddress` (JSON), `shippingLabelUrl`, `trackingNumber`, `shippedAt`. Status flow extended to `... → sold → paid → shipped`. `npx prisma db push` applied.

**Sync helper (`lib/ebay-orders.ts` + `lib/ebay-sync-cache.ts`):**
- Calls eBay's Fulfillment API (`GET /sell/fulfillment/v1/order`) every 60 seconds (rate-limited) for the past 30 days of orders.
- For each line item, matches against `internalListing.ebayListingId` / `ebayListing.ebayListingId` and updates the corresponding row with: order ID, buyer name/address, paidAt timestamp, and new status (sold / paid / shipped based on `orderPaymentStatus` + `orderFulfillmentStatus`). Won't downgrade if user already marked shipped.
- `/api/admin/ebay/sync-orders` exposes a manual POST for forced sync.

**Listings page (`app/admin/listings/page.tsx`):**
- Calls `syncOrdersThrottled()` on every page load alongside the existing scheduled→active flip.
- Added "Waiting for payment" tab to `ListingsClient.tsx` showing all `status="sold"` rows (both internal + consignment, merged + sorted). Each row has a "Mark as paid" button.

**Shipping page (`app/admin/shipping/...`):**
- New route `/admin/shipping` with two filter tabs: Ready to Ship (status=paid) and Shipped (status=shipped).
- Shows player, buyer name + full address, package size + auto-picked service (eBay Standard Envelope when sold price ≤ $50 and US destination, otherwise USPS Ground Advantage), sale price.
- "Create label" button calls `POST /api/admin/shipping/{kind}/{id}/create-label` which:
  1. POST to `/sell/logistics/v1/shipping_quote` for rates
  2. Picks ESE if eligible, else cheapest carrier
  3. POST to `/sell/logistics/v1/shipment` to buy the label
  4. Saves `labelDownloadUrl` + `trackingNumber` to the DB, flips status to "shipped"
  5. POSTs to `/sell/fulfillment/v1/order/{orderId}/shipping_fulfillment` so eBay notifies the buyer
- "Mark as shipped" button for cases where the user bought the label outside Card Cloud.

**Admin sidebar:** Added "Shipping" link with 📮 icon under Consignment section.

**Manual override routes:**
- `POST /api/admin/internal-listings/{id}/mark-paid` and `/consignment-listings/{id}/mark-paid` — manual flip from sold→paid.
- `POST /api/admin/shipping/{kind}/{id}/mark-shipped` — manual flip from paid→shipped without label generation.

**Files changed:**
- New: `lib/ebay-orders.ts`, `lib/ebay-sync-cache.ts`, `app/api/admin/ebay/sync-orders/route.ts`, `app/api/admin/internal-listings/[id]/mark-paid/route.ts`, `app/api/admin/consignment-listings/[id]/mark-paid/route.ts`, `app/api/admin/shipping/[kind]/[id]/mark-shipped/route.ts`, `app/api/admin/shipping/[kind]/[id]/create-label/route.ts`, `app/admin/shipping/page.tsx`, `app/admin/shipping/ShippingClient.tsx`
- Modified: `prisma/schema.prisma`, `app/admin/layout.tsx`, `app/admin/listings/ListingsClient.tsx`, `app/admin/listings/page.tsx`

---

## 2026-05-27 — Add View link to "Listed Directly on eBay" rows + price formatting

Direct eBay listing rows now show a `View →` link next to the eBay #, same as the Internal listings table. Also swapped the inline price formatting to use the shared `usd()` helper for consistency (was using `toLocaleString` with `minimumFractionDigits` only — same effect but less repetition).

**Files changed:** `app/admin/listings/ListingsClient.tsx`

---

## 2026-05-27 — Format prices as $X.XX (always two decimals)

**Issue:** Prices in the listings table were showing as `$17.5` and `$9.5` because `toLocaleString()` defaults to dropping trailing zeros.

**Fix:** Added `usd()` helper at the top of `ListingsClient.tsx`:
```ts
const usd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
```
Replaced every `n.toLocaleString()` for prices with `usd(n)` (current bid, start price, BIN, sold price) across both the consignment and internal tables.

**Files changed:** `app/admin/listings/ListingsClient.tsx`

---

## 2026-05-27 — Show current bid + bid count on auction rows

**Request:** Auctions should display the current bid (and bid count) when there's at least one bid — was only showing the start price.

**Implementation:**
- New `lib/ebay-live-prices.ts` helper that calls `GetMyeBaySelling` once and returns a `Map<ebayListingId, { currentPrice, bidCount }>`. Cached for 60 seconds to keep page loads fast and avoid burning the eBay API on every refresh.
- Listings page calls `getLivePrices()` alongside the DB queries and merges the values into each row.
- Both the consignment and internal listing tables render `$X (N bids)` above the start price when `currentBid` is set AND `bidCount > 0`. For Buy-It-Now listings or zero-bid auctions, the row looks unchanged.

**Files changed:** `lib/ebay-live-prices.ts` (new), `app/admin/listings/page.tsx`, `app/admin/listings/ListingsClient.tsx`

---

## 2026-05-27 — Auto-flip scheduled → active when start time passes

**Issue:** Listings scheduled for 10pm yesterday went live but still showed "scheduled" in the Card Cloud table the next day. Status should automatically transition to "active" once the start time passes.

**Fix:** `app/admin/listings/page.tsx` now runs an `updateMany` on every page load that flips both `internalListing` and `ebayListing` rows from `status='scheduled'` to `status='active'` whenever `scheduledTime <= now` (and `ebayListingId` is set). Mirrors eBay's own internal state transition without needing a separate cron job.

**Files changed:** `app/admin/listings/page.tsx`

---

## 2026-05-27 — Fix: scheduled listings appeared in "Listed Directly on eBay" section

**Issue:** Cards listed via Card Cloud were also showing up under "Listed Directly on eBay" if their status was "scheduled" (not yet live).

**Root cause:** `direct-listings/route.ts` filter only matched `status: "active"` when collecting known eBay IDs. Scheduled listings (`status: "scheduled"`) weren't being excluded from the eBay GetMyeBaySelling response.

**Fix:** Both `ebayListing` and `internalListing` filters now match `status: { in: ["active", "scheduled"] }`.

**Files changed:** `app/api/admin/ebay/direct-listings/route.ts`

**Note:** DB inspection shows 6 stale Bo Jackson records with old `scheduled` eBay IDs from earlier withdraw+republish iterations during testing. These IDs are no longer active on eBay, so they don't appear in GetMyeBaySelling — they only clutter the Internal table. Cleanup of those duplicates is a separate task.

---

## 2026-05-26 — Also include Collectibles > Autographs > Sports in category dropdown

**Issue:** User noted a similar listing on eBay was filed under `Collectibles & Art > Collectibles > Autographs > Sports`, which is a separate tree from `Sports Mem, Cards & Fan Shop`. Our category fetch only walked the latter.

**Fix:** `categories/route.ts` now fetches BOTH `64482` (Sports Mem, Cards & Fan Shop) and `1` (Collectibles) in parallel. From the Collectibles tree, it filters to just the `Autographs/*` subtree (the rest — coins, comics, vintage toys — isn't relevant), prefixes those labels with the full `Collectibles > Autographs > ...` breadcrumb, then merges with the Sports Mem leaves and sorts alphabetically.

**Files changed:** `app/api/admin/ebay/categories/route.ts`

---

## 2026-05-26 — Expand listing categories beyond Trading Card Singles

**Request:** Couldn't list an autographed baseball — only trading card categories appeared in the listing form.

**Root cause:** `/api/admin/ebay/categories` was hard-coded to walk only the children of category `261328` (Sports Trading Cards), so all subcategories were card-related. The fallback list also re-used `261328` for every option.

**Fix:**
- Changed parent to `64482` (Sports Mem, Cards & Fan Shop) — covers Trading Cards, Autographs-Original, Game Used Memorabilia, Fan Apparel & Souvenirs.
- Walker now recurses to LEAF categories (only leaves can accept a listing on eBay) and builds breadcrumb labels like `"Autographs-Original > Baseball-MLB > Balls"` so the user can find specific categories.
- Updated `FALLBACK_CATEGORIES` with a curated list of common card + memorabilia leaves covering MLB / NFL / NBA / NHL autographed balls, bats, jerseys, helmets, photos, pucks, plus Game Used Memorabilia and Fan Apparel & Souvenirs parents.

**Note:** `ebayCondition()` and the conditionDescriptors lookup are category-aware — they query eBay's metadata API per-category, so memorabilia listings will get the right condition descriptors automatically.

**Files changed:** `app/api/admin/ebay/categories/route.ts`, `app/admin/internal-listings/new/InternalListingEditor.tsx`

---

## 2026-05-26 — Three changes: Original aspect fix, AI scan improvements, Settings → Rates

**1. Fix: "Original or Licensed Reprint" aspect didn't show on eBay** — eBay's actual aspect name uses a slash: `"Original/Licensed Reprint"`. Updated `buildAspects()` in `lib/ebay-api.ts`.

**2. AI photo scan improvements** (`lib/vision.ts`, `app/api/scan/route.ts`, `InternalListingEditor.tsx`):
- Vision prompt now asks for `isAutographed` (boolean) — detects visible signatures, "AUTO" labels, sticker autographs, etc.
- Card number prompt strengthened: explicitly mentions raw cards have card numbers on the back, near top/bottom in small text, often prefixed with "#" or "No." (strip those). Card numbers can be purely numeric, letters, or combos (RAD-JG, 87BJ).
- `VisionResult` type + scan route response now include `isAutographed`.
- Editor's `scanSlab()`: when AI detects autograph, turns the Autographed toggle ON and defaults Signed By to the detected player name (only if Signed By is currently empty — still editable).

**3. New Settings → Rates → "eBay listing defaults" section** for:
- Listing type (Auction vs Buy It Now)
- Auction duration (1/3/5/7/10 days)
- Default auction start price ($)
- Default scheduled start time (HH:MM 24-hour, local timezone)

Added two new keys to `ebay-listing-defaults-shared.ts` (`ebay_ld_default_start_price`, `ebay_ld_default_scheduled_time`). Wired into the editor:
- `makeEmptyDraft()` pre-fills `startPrice` from `defaultStartPrice`.
- `ScheduleWidget` accepts a `defaultTime` prop and uses it when the user hasn't picked a time yet — parses "HH:MM" into the hour/minute/AM/PM selectors.
- `ListingForm` plumbs `defaultScheduledTime` from `ebayDefaults.defaultScheduledTime` through to `ScheduleWidget`.

**Files changed:** `lib/ebay-api.ts`, `lib/vision.ts`, `app/api/scan/route.ts`, `app/admin/internal-listings/new/InternalListingEditor.tsx`, `lib/ebay-listing-defaults-shared.ts`, `app/admin/settings/page.tsx`, `app/admin/settings/SettingsTabs.tsx`, `app/admin/settings/SettingsClient.tsx`, `app/admin/consignments/[id]/ConsignmentOrderAdmin.tsx`

---

## 2026-05-26 — Add Subset + Print Run to Card Details + new title format

**Request:** Add a Subset field to the Card Details section (used for title generation). For example "2002 Topps Archives Autoproofs" — Topps is manufacturer, Archives is set, Autoproofs is subset. Also add Print Run there (where user enters "058/300") which flows into the title AND the Print Run item-specific field. Change title format from "Year Manufacturer Set #Card Player AUTO #'d Serial" to "Player Name - Year Manufacturer Set Subset Card# - #'d Serial Auto" (subset/serial/Auto only if present).

**Examples:**
- Full: `Bo Jackson - 2002 Topps Archives Autoproofs #4 - #'d 058/300 Auto`
- Minimal: `Bo Jackson - 1987 Topps #170`

**Changes:**
- `InternalListingEditor.tsx`: added Subset input next to Set (3-col row: Manufacturer / Set / Subset). Added Print Run input next to Card Number (3-col row: Card Number / Print Run / Sport).
- Print Run is bound directly to `draft.printRun` (single source of truth — same field already used in the Card Identity section of the eBay form).
- `buildCardData()` now passes `printRun` and sets `numbered: !!printRun, serialNumber: printRun || null` so the AI sees the print run as the serial number.
- `generate/route.ts` `QUICK_SYSTEM` prompt updated with new title format rules and examples.

**Files changed:** `app/admin/internal-listings/new/InternalListingEditor.tsx`, `app/api/admin/listings/generate/route.ts`

---

## 2026-05-26 — Package weight + dimensions auto-switch when toggling Graded

**Request:** For new listings — default weight 3 oz if graded, 1 oz if ungraded. (Same defaults already exist in `ebay-listing-defaults-shared.ts` but weren't being applied based on graded state.)

**Fix:**
- `makeEmptyDraft()` in `InternalListingEditor.tsx` now defaults to **ungraded** package dimensions/weight (since new listings start with `graded=false`).
- Wrapped `setGraded` with a function that, for new listings only, re-applies the matching defaults whenever the user toggles the Graded switch:
  - Graded ON → weight 3 oz, dims 11.0 × 6.0 × 1.0 in (PSA/BGS slab size)
  - Graded OFF → weight 1 oz, dims 10.0 × 4.0 × 1.0 in (toploader/penny sleeve)
- For existing listings (editing), the toggle does NOT overwrite saved values.

**Files changed:** `app/admin/internal-listings/new/InternalListingEditor.tsx`

---

## 2026-05-26 — Add Card Size to eBay aspects

**Issue:** Card Size selected as "Standard" in the form, saved correctly to DB (`cardSize: "Standard"`), but missing from the eBay item specifics.

**Root cause:** `buildAspects()` in `lib/ebay-api.ts` had the cardSize field in its input type but never added `aspects["Card Size"]`.

**Fix:** Added `if (input.cardSize) aspects["Card Size"] = [input.cardSize];` next to the existing Type/Material/Card Thickness lines.

**Files changed:** `lib/ebay-api.ts`

---

## 2026-05-26 — Autograph fields (Format / Authentication / Auth #) now save

**Issue:** Typed "Sticker" in Autograph Format → revised → eBay still shows blank. DB confirmed: `autographFormat: null`, `autographAuthentication: null`.

**Root cause:** The InternalListingEditor save body was missing all three autograph-detail fields. The PATCH route accepts them, the form had them in `draft.*`, but they were never included in the body sent to the API.

**Fix:** Added to the save body in `InternalListingEditor.tsx`:
```ts
signedBy: draft.signedBy || signedBy || null,
autographAuthentication: draft.autographAuthentication || null,
autographAuthNumber:     draft.autographAuthNumber     || null,
autographFormat:         draft.autographFormat         || null,
```

(`signedBy` was already being sent as the top-level state but the eBay form section uses `draft.signedBy` — added the same `draft || top` fallback we used for team/sport.)

**Files changed:** `app/admin/internal-listings/new/InternalListingEditor.tsx`

---

## 2026-05-26 — Autograph Format: input + datalist (pick suggestion OR type custom)

**Iteration:** Previous fix made it a hard `<select>` which forced one of three values. eBay actually allows free-text — the three values are just suggestions.

**Fix:** Replaced the `<select>` with `<input list="...">` + `<datalist>` so the user gets the three suggestions in a typeahead but can also enter any custom value. Matches eBay's "Search or enter your own" UI.

**Files changed:** `app/admin/consignments/[id]/ConsignmentOrderAdmin.tsx`

---

## 2026-05-26 — Autograph Format converted to dropdown with eBay's exact values

**Issue:** Autograph Format field was a free-text input — typing "sticker" or any non-matching value resulted in eBay's item specific being blank because the category aspect requires one of three specific values.

**Fix:** Replaced the free-text input with a dropdown (both occurrences in `ConsignmentOrderAdmin.tsx` — `ebay_team_league` widget at ~line 1642 and the legacy `ItemSpecificsEditor` at ~line 2334). Options are eBay's exact accepted values:
- Label or Sticker
- Hard Signed
- Cut

**Files changed:** `app/admin/consignments/[id]/ConsignmentOrderAdmin.tsx`

---

## 2026-05-26 — Fix: PATCH route was crashing because `params` is now a Promise

**Issue:** All Save attempts on the internal-listings editor returned 500. PATCH logs revealed Next.js 16's `params` is async — accessing `params.id` directly resolves to `undefined`, then Prisma rejects the `where: { id: undefined }` query. This silently broke saves for the whole editor.

The form was correctly sending team / league — the route was discarding the entire write because of the params error:
```
[internal-listings PATCH] undefined team: "Las Vegas Raiders" league: "National Football League (NFL)"
```

**Fix:** Updated GET, PATCH, and DELETE handlers in `app/api/admin/internal-listings/[id]/route.ts` to type `params` as `Promise<{ id: string }>` and `const { id } = await params;` before use.

**Files changed:** `app/api/admin/internal-listings/[id]/route.ts`

---

## 2026-05-26 — TeamCombobox now commits free-text values

**Issue:** Team field wouldn't save unless the user clicked an exact match in the suggestions dropdown. Typing "Las Vegas Raiders" and clicking away reverted the field to empty. eBay's Team aspect is FREE_TEXT, so they accept any team string.

**Fix:** Updated `TeamCombobox` in `ConsignmentOrderAdmin.tsx` — when the input loses focus (click outside), commit whatever the user typed (if non-empty) via `onChange(typed)`. Only revert if the user left it blank. Matches eBay's "pick from list OR type your own" behavior.

**Files changed:** `app/admin/consignments/[id]/ConsignmentOrderAdmin.tsx`

---

## 2026-05-26 — Dropdown labels now match eBay's exact strings

**Request:** Dropdown options should match what eBay shows when listing directly on their website (long forms).

**Changes:**
- `lib/sports-data.ts`: `LeagueData.label` for MLB/NFL/NBA/WNBA/NHL/MLS/UFC now stores the long form ("National Football League (NFL)" etc.). Removed the `ebayValue` field — label IS the eBay value now.
- `LeagueData.sport` updated for NHL → "Ice Hockey", UFC → "Mixed Martial Arts (MMA)" (matching eBay's Sport list).
- `SPORT_LIST`: "Hockey" → "Ice Hockey", "MMA" → "Mixed Martial Arts (MMA)", "Track & Field" → "Athletics", "NASCAR" → "Auto Racing", "Rugby" → "Rugby League"/"Rugby Union". All match eBay's authoritative sport list.
- Added `canonicalizeLeague()` / `canonicalizeSport()` helpers in `sports-data.ts` that translate old short-form values ("NFL", "Hockey") to the new long-form labels. Used in the editor's draft init so existing records with old data still match a dropdown option.
- `buildAspects` in `lib/ebay-api.ts` now runs `input.sport` / `input.league` through canonicalize* before sending to eBay (covers any legacy data).
- `SPORT_LEAGUE` map in `InternalListingEditor.tsx` updated keys/values to match new long forms (e.g., "Football" → "National Football League (NFL)").
- `import-direct/route.ts` no longer normalizes imported league to short form — stores eBay's full string as-is, which now matches the dropdown.

**Files changed:** `lib/sports-data.ts`, `lib/ebay-api.ts`, `app/api/admin/ebay/import-direct/route.ts`, `app/admin/internal-listings/new/InternalListingEditor.tsx`

---

## 2026-05-26 — Sport + League aspect mappings confirmed against eBay Taxonomy API

Queried eBay's `getItemAspectsForCategory` for 261328 (Trading Card Singles) and got the authoritative lists:
- **Sport** (FREE_TEXT, 104 values): includes "Football", "Baseball", "Basketball", but NOT "Hockey" — must be "Ice Hockey". And NOT "MMA" — must be "Mixed Martial Arts (MMA)".
- **League** (FREE_TEXT, 546 values): confirmed long forms for NFL/MLB/NBA/NHL/MLS/UFC. Also confirmed `WWE` is short-form "WWE" in eBay's list (not "World Wrestling Entertainment (WWE)" as I'd guessed earlier).
- **Card Condition** (SELECTION_ONLY, 4 values): "Near Mint or Better", "Excellent", "Very Good", "Poor". "Graded" is NOT a value — graded cards use the Professional Grader descriptor, not Card Condition.

**Fixes:**
- Added `ebaySportValue()` helper + `SPORT_TO_EBAY` map (`Hockey → Ice Hockey`, `MMA → Mixed Martial Arts (MMA)`).
- Reverted WWE mapping back to plain "WWE".
- `buildAspects` now skips the `Card Condition` aspect entirely for graded cards (was sending invalid value "Graded" before).
- Removed the temporary `/api/admin/ebay/debug-aspects` route.

**Files changed:** `lib/sports-data.ts`, `lib/ebay-api.ts`, removed `app/api/admin/ebay/debug-aspects/`

---

## 2026-05-26 — Map dropdown league labels to eBay's required long-form aspect values

**Issue:** Team/League aspects on the published eBay listing came back blank even though we sent "NFL" / "Las Vegas Raiders" in the inventory item PUT. eBay's category 261328 League aspect requires the full localized form `"National Football League (NFL)"` — "NFL" alone gets silently dropped.

**Fix:**
- Added `ebayValue?: string` field to `LeagueData` in `lib/sports-data.ts`. Falls back to `label` if not set.
- Added `ebayLeagueValue(draftLeague)` helper that looks up the long form for a dropdown label.
- `buildAspects` in `lib/ebay-api.ts` now uses `ebayLeagueValue(input.league)` before setting `aspects["League"]`.
- Populated long-form values for: MLB → Major League Baseball (MLB), NFL → National Football League (NFL), NBA → National Basketball Association (NBA), WNBA, NHL, MLS, UFC → Ultimate Fighting Championship (UFC), WWE → World Wrestling Entertainment (WWE).
- Added a temporary admin endpoint `/api/admin/ebay/debug-aspects` that queries eBay's Taxonomy API for category 261328 aspects + their accepted values, so we can extend coverage to less common leagues as needed.

Team values appear to already match eBay's format (city + nickname), so no mapping added there yet — confirm via debug endpoint once we have the data.

**Files changed:** `lib/sports-data.ts`, `lib/ebay-api.ts`, `app/api/admin/ebay/debug-aspects/route.ts` (new)

---

## 2026-05-26 — Fix: Team / League / Season / Parallel never saved from internal-listing editor

**Issue:** Entered "Las Vegas Raiders" as Team and "NFL" as League in the form, but item specifics on eBay showed blank for both. DB inspection: `team=""`, `league=null`, `season=null`.

**Root cause:** The save body in `InternalListingEditor.tsx` was sending the top-level state `team` variable (which was never wired to the form's eBay-section Team dropdown), and didn't send `league`, `season`, `parallel`, or `features` at all. The form actually binds these eBay-specific inputs to `draft.team` / `draft.league` / etc.

**Fix:** Save body now prefers `draft.*` values for these fields:
```ts
sport:    draft.sport  || sport,
team:     draft.team   || team,
league:   draft.league || null,
season:   draft.season || null,
parallel: draft.parallel || null,
features: draft.features,
```

The PATCH endpoint at `app/api/admin/internal-listings/[id]/route.ts` already accepts all of these — the data just wasn't being sent.

**Files changed:** `app/admin/internal-listings/new/InternalListingEditor.tsx`

---

## 2026-05-26 — Fix: ScheduleWidget UTC-date bug + show actual timezone

**Issue:** Reopened the editor with a previously-saved time → the form initialized the **date** input from `parsed.toISOString().slice(0, 10)` which returns the **UTC date**, not the local date. If the stored UTC time crossed midnight (e.g., `2026-05-27T02:00Z` = 10pm EDT 5/26), the form showed `5/27` instead of `5/26`. When the user only changed one field, the other kept the wrong value and the new save was wrong.

Also: the timezone label was hardcoded `"EST"` even though `new Date(y, m, d, h, min)` uses the **browser's** local timezone. Misleading for anyone whose browser isn't on EDT/EST.

**Fix:**
- `parsed.toISOString().slice(0, 10)` → custom `localDateStr(parsed)` helper that uses `getFullYear/Month/Date` so the date input shows the LOCAL date.
- `<span>EST</span>` → `<span>{tzAbbr}</span>` where `tzAbbr` comes from `Intl.DateTimeFormat` (e.g., "EDT", "PDT", "GMT+1" — whatever the user's browser actually uses).
- Added a "Will go live at <full date+time+TZ>" preview line under the picker so the user can sanity-check before saving.

**Files changed:** `app/admin/consignments/[id]/ConsignmentOrderAdmin.tsx`

---

## 2026-05-26 — Fix: Scheduled start time changes now use withdraw + republish

**Request:** Trading API ReviseItem failed for Inventory API-created listings ("Inventory-based listing management is not currently supported by this tool").

**Root cause:** eBay treats Inventory API and Trading API as separate domains. A listing created via the Inventory API can't be managed via Trading API endpoints like ReviseFixedPriceItem.

**Fix:** For Inventory API listings, the only way to change `listingStartDate` on a PUBLISHED-scheduled offer is:
1. Withdraw the published offer (back to UNPUBLISHED state)
2. PUT the offer with new `listingStartDate`
3. Republish (eBay assigns a new listingId)

Updated `reviseEbayListing` to detect when input has a future `scheduledTime` and the existing offer is PUBLISHED, then run the withdraw → update → republish flow. The returned `newListingId` flows back through the revise-internal route to update the DB record's `ebayListingId` and `url`.

Trade-off: the eBay listing ID changes when rescheduling. The Card Cloud DB is updated automatically; if anyone has the old eBay URL bookmarked it'll 404.

**Files changed:** `lib/ebay-api.ts`

---

## 2026-05-26 — Fix: Revise on eBay now updates scheduled start time + auto-saves first

**Request:** Clicked Revise on eBay after changing scheduled time. No error returned but eBay still showed the old time.

**Two combined issues:**

1. **`reviseOnEbay()` didn't save the form first** — the route reads from DB, so unsaved form edits never made it to the revise payload. Updated `reviseOnEbay()` in `InternalListingEditor.tsx` to call `saveDraft()` before posting to the revise endpoint.

2. **eBay's Inventory API offer PUT silently ignores `listingStartDate` once an offer is PUBLISHED** (even for a scheduled future-start listing). The offer update returned 200 but the listing's StartTime stayed unchanged. Added a `ReviseFixedPriceItem` / `ReviseItem` Trading API call after the offer PUT to actually move the start time on eBay. If eBay rejects the start-time change (e.g., listing already live, or auction has bids), we surface the error to the user instead of pretending it worked.

**Files changed:** `lib/ebay-api.ts`, `app/admin/internal-listings/new/InternalListingEditor.tsx`

---

## 2026-05-26 — Fix: Revise on eBay also needs conditionDescriptors

**Request:** Revise on eBay failed with the same Card Condition (40001) required error.

**Root cause:** I added `conditionDescriptors` to `createEbayListing` but `reviseEbayListing` also PUTs the inventory item and was missing the field.

**Fix:** Extracted `resolveConditionDescriptors()` helper that queries eBay's metadata API and builds the right descriptor IDs. Both `createEbayListing` and `reviseEbayListing` now call it. Also covered the format-change branch in revise (which does a fresh PUT after deleting).

**Files changed:** `lib/ebay-api.ts`

---

## 2026-05-26 — Add Revise on eBay for internal listings

**Request:** When a listing is already on eBay (live or scheduled), the editor only showed "List on eBay" which would create a duplicate. eBay itself allows editing a scheduled listing, so the editor should too.

**Implementation:**
- Created `/api/admin/ebay/revise-internal/route.ts` that mirrors the consignment revise route but operates on `InternalListing`. Calls `reviseEbayListing` from `lib/ebay-api.ts` (which already handles updating the inventory item, offer body, and start time without ending the listing — unless the auction/fixed-price format changes).
- Added `reviseOnEbay()` handler in `InternalListingEditor.tsx`.
- The form's "Revise on eBay" button (red) appears in place of "List on eBay" when `existing.ebayListingId` is set. Same button slot, just swapped action.

Now: edit any field (price, scheduled time, photos, description, etc.) on a listing already on eBay → click **Revise on eBay** → changes push to eBay's live/scheduled listing.

**Files changed:** `app/api/admin/ebay/revise-internal/route.ts` (new), `app/admin/internal-listings/new/InternalListingEditor.tsx`

---

## 2026-05-26 — Fix: Schedule time was shifted 5 hours forward (double timezone conversion)

**Request:** Scheduled a listing for 10pm EDT on 5/26, but eBay shows it scheduled for 3am EDT on 5/27 — exactly 5 hours later than intended.

**Root cause:** `ScheduleWidget.commit()` in `ConsignmentOrderAdmin.tsx` was applying the EST offset twice. `new Date(year, month, day, hours, minutes)` already creates a Date in the browser's local timezone, and `.toISOString()` already converts it to UTC. The code was then adding a +5h offset on top, shifting the final UTC time 5 hours ahead.

**Fix:** Removed the broken `+estOffset` line. The browser's native local→UTC conversion is correct on its own.

**Note for the existing scheduled eBay listing (298356312752):** It's currently scheduled for 03:00 EDT 5/27 on eBay (the wrong time). You can either let it go live then, or end the eBay listing (eBay → Sell → Active listings) and re-list it with the corrected start time.

**Files changed:** `app/admin/consignments/[id]/ConsignmentOrderAdmin.tsx`

---

## 2026-05-26 — Scheduled status + better duplicate cleanup + eBay link in listings table

**Request:** After successful publish, listings page showed 4 duplicates for the same card (2 drafts + 2 active). Couldn't delete drafts (error message), couldn't tell which "active" was the real eBay-linked one, and scheduled listings showed as "active" instead of "scheduled".

**Fixes:**

1. **Scheduled status on publish** — `list-internal/route.ts` now fetches the listing's `scheduledTime` after a successful publish and sets `status = "scheduled"` if it's in the future, `"active"` otherwise. The display in the listings table will switch to "active" automatically once the eBay start time passes.

2. **Display fallback for legacy active+scheduled rows** — the listings table renders the status as "scheduled" whenever `scheduledTime` is in the future, regardless of the saved DB status. Existing rows that were marked "active" before this fix display correctly.

3. **Loosened DELETE restriction** — previously blocked any record with `status="active"`. Now only blocks listings that are **actually live on eBay** (have both `status` in active/scheduled AND `ebayListingId` set). Orphan rows from failed publishes (active status, no ebayListingId) can now be deleted.

4. **eBay link visible per row** — internal listings now display `eBay #<id>` plus a `View →` link when a real eBay listing exists, so the user can distinguish the real listing from any orphans.

5. **Scheduled status pill** — new amber `bg-amber-100 text-amber-700` style for scheduled, with a "Starts <date>" sub-line.

6. **Smarter button visibility** — "End listing" now only shows when there's a real eBay ID. Delete button now shows whenever the row isn't actually on eBay.

**Files changed:** `app/api/admin/ebay/list-internal/route.ts`, `app/api/admin/internal-listings/[id]/route.ts`, `app/admin/listings/page.tsx`, `app/admin/listings/ListingsClient.tsx`

---

## 2026-05-26 — Fix: Send required "Card Condition" item specific + remove duplicate condition input

**Request:** Got error `Card Condition (40001) is a required field` even after selecting condition in the form. Also there was a duplicate condition input in Card Details that confused things.

**Two fixes:**

1. **Send "Card Condition" item specific** — eBay category 261328 requires this aspect (separate from the condition enum). Updated `buildAspects()` in `lib/ebay-api.ts`:
   - For graded cards → `Card Condition = "Graded"`
   - For ungraded cards → `Card Condition = <user's cardCondition dropdown value>` (Near mint or better / Excellent / Very good / Poor — matches eBay's own option labels)

2. **Removed the duplicate free-text condition input** in the Card Details section of `InternalListingEditor.tsx` — the proper Condition section dropdown (with Condition Type + Card Condition) is the canonical place to set it. Also removed the now-redundant `cardCondition: !graded ? condition : ""` overwrite in the generate-listing patch so the user's dropdown selection is preserved.

**Files changed:** `lib/ebay-api.ts`, `app/admin/internal-listings/new/InternalListingEditor.tsx`

---

## 2026-05-26 — Fix: Correct enum value for Ungraded condition

**Request:** After the first condition fix, publish still failed with `errorId 25059` — same error, but condition 3000 instead of 5000.

**Root cause:** I mapped Ungraded → `USED_EXCELLENT`, but that enum value translates to numeric **3000**, which the category also rejects. The correct numeric code for "Ungraded" in category 261328 is **4000**, which corresponds to enum `USED_VERY_GOOD`.

**Enum → numeric reference:** LIKE_NEW=2750, USED_EXCELLENT=3000, USED_VERY_GOOD=4000, USED_GOOD=5000, USED_ACCEPTABLE=6000. Category 261328 accepts only 2750 (Graded) and 4000 (Ungraded).

**Files changed:** `lib/ebay-api.ts`

---

## 2026-05-26 — Fix: eBay publish failing silently due to invalid condition value

**Request:** User scheduled an internal listing for 10pm — but it never showed up on eBay's scheduled listings.

**Root cause (two bugs):**

1. **eBay rejected the publish call with errorId 25059**: "Condition information 5000 does not exists or is not a valid condition for category 261328". As of eBay's recent policy update, the Trading Card Singles category (261328) only accepts two conditions: **Graded** (LIKE_NEW / 2750) or **Ungraded** (USED_EXCELLENT / 4000). Our `ebayCondition()` was outputting `USED_GOOD`/`USED_VERY_GOOD`/`USED_ACCEPTABLE` from the user's condition picker — all rejected.

2. **list-internal route silently returned 200 on failure**: `createEbayListing` catches its own errors and returns `{ ok: false, error }` instead of throwing. The route wrapped it in try/catch expecting throws, so the catch never fired. The DB was then updated with `status="active"` and `ebayListingId=undefined`, and the API returned `{ ok: true }`, leaving the user thinking the listing was live.

**Fix:**
- `lib/ebay-api.ts` — `ebayCondition()` now returns only `LIKE_NEW` (graded) or `USED_EXCELLENT` (ungraded), regardless of the free-text condition the form provides.
- `app/api/admin/ebay/list-internal/route.ts` — explicitly checks `result.ok`; on failure, writes the error to `lastError` and returns `{ error, status: 500 }` so the editor displays it.

**Existing bad record:** The user's listing has `status="active"` but no `ebayListingId` (publish failed before the listing-id was assigned). The "List on eBay" button is still visible in the editor (`draft.url` is null, so it doesn't show "✓ Listed"). On retry: inventory item PUT will succeed, offer creation will detect the existing offer and recreate it, publish will succeed with the new valid condition.

**Files changed:** `lib/ebay-api.ts`, `app/api/admin/ebay/list-internal/route.ts`

---

## 2026-05-26 — Fix: Fixed-price listings now populate "Buy It Now price" field

**Request:** Listed price still not showing on imported eBay listings.

**Root cause:** The form has TWO price fields — Start price (active for auctions) and Buy It Now price (active for fixed-price listings). eBay's GetItem returns the fixed price under `<StartPrice>`, with `<BuyItNowPrice>` empty. My import stored `startPrice = 140`, `buyItNowPrice = null`. For a fixed-price listing the form binds the visible/active price input to `draft.buyItNowPrice`, which was empty.

**Fix:** Mirror the eBay price into `buyItNowPrice` when the listing type is "fixed", so the active field in the form is populated. Auctions still get only `startPrice`.

Also extended the bad-import detector to catch fixed-price records with null `buyItNowPrice`, so existing bad imports auto-trigger a clean re-import.

**Files changed:** `app/api/admin/ebay/import-direct/route.ts`, `app/admin/internal-listings/[id]/page.tsx`

---

## 2026-05-26 — Unsaved eBay imports stay in "Listed Directly on eBay" section

**Request:** Clicking Edit on a directly-listed eBay card always moved it to the Internal Listings table, even if the admin didn't actually save any changes. It should only move once the listing has actually been edited and saved.

**Root cause:** The `import-direct` route creates an InternalListing DB record as soon as Edit is clicked (so the editor has a record to bind to). The listings page then sees that record and shows it in the Internal table, removing it from "Listed Directly on eBay" via the direct-listings API's known-IDs filter.

**Fix:** Use `updatedAt > createdAt` as the "has been saved" marker. Prisma's `@updatedAt` directive auto-advances on every update operation but stays equal to `createdAt` on initial `create()`. Unsaved imports therefore have `updatedAt == createdAt`.

- `direct-listings/route.ts` — only excludes InternalListings where `updatedAt > createdAt + 1s` (1s buffer for clock skew)
- `listings/page.tsx` — filters the Internal table to hide unsaved imports

Result: clicking Edit creates a DB record but the listing visually stays in "Listed Directly on eBay" until the admin clicks Save. Cancel just navigates away, leaving the now-orphan record — which on next page load is still treated as a direct listing.

**Files changed:** `app/api/admin/ebay/direct-listings/route.ts`, `app/admin/listings/page.tsx`

---

## 2026-05-26 — Fix: Re-import from eBay button now actually refreshes form fields

**Request:** After clicking "Re-import from eBay", the form still showed the old (incorrect) values for price, shipping, etc., even though the DB was being updated correctly.

**Root cause:** Debug logs confirmed `import-direct` was extracting and storing the correct values (e.g., `price: 140 | free: true`). The bug was in React: `InternalListingEditor` uses `useState(e?.startPrice ?? "")` to initialize form fields. `useState` only reads its initial value on **first mount** — subsequent prop changes from navigation are ignored. When `router.push()` moved to a new listing ID within the same route segment, React reused the editor component without resetting state, so the form showed stale values from the old record.

**Fix:** Added `key={listing.id}` to `<InternalListingEditor>` in `[id]/page.tsx`. When the listing ID changes, React unmounts the old component and mounts a fresh one with new `useState` initial values reading the new record.

**Files changed:** `app/admin/internal-listings/[id]/page.tsx`

---

## 2026-05-26 — Add Cancel and Re-import from eBay buttons to listing editor

**Request:** While editing a listing, no Cancel button was visible and no way to discard edits or pull fresh data from eBay.

**Completed:**
- Added prominent **✕ Cancel** button in editor header (visible button instead of small text link). Navigates back to listings; unsaved form state is discarded.
- Added **↻ Re-import from eBay** button — only shows for listings that have an `ebayListingId` (imported from eBay). Asks for confirmation, then calls `import-direct` with `force=true` to delete the current record and re-import fresh from eBay, navigating to the new record ID.
- Extended `import-direct/route.ts` to accept a `force` flag in the request body that bypasses the "return existing record" short-circuit.

**Files changed:** `app/admin/internal-listings/new/InternalListingEditor.tsx`, `app/api/admin/ebay/import-direct/route.ts`

---

## 2026-05-26 — Fix: eBay import now captures price and correct shipping cost type

**Request:** After clicking Edit on a direct eBay listing, the form was missing the listed price and shipping type.

**Root causes fixed:**
1. **Price** — was reading only `<StartPrice>`; for fixed-price listings eBay sometimes only populates `<BuyItNowPrice>` or `<SellingStatus><CurrentPrice>`. Now falls back through all three.
2. **Shipping cost type** — import was writing `"Flat: Specify your own postage costs"` but the form dropdown's exact options are `"Flat rate: Same cost regardless of buyer location"` and `"Calculated: Cost varies based on buyer location"`. Mismatch made the dropdown reset to default. Now writes the correct string.
3. Bad-import detector extended to catch existing records with `startPrice === 0` or the wrong shipping string, so they auto-clean and re-import.

**Files changed:** `app/api/admin/ebay/import-direct/route.ts`, `app/admin/internal-listings/[id]/page.tsx`

---

## 2026-05-26 — Fix: eBay description now imported as plain text (matches AI-generated format)

**Request:** Description still showed raw `&lt;div&gt;` HTML entities in the editor instead of properly formatted text.

**Root cause:** AI-generated descriptions are stored as PLAIN TEXT with line breaks and emojis. `list-internal/route.ts` wraps them in `<p>`/`<br>` HTML via `toHtmlDescription()` only at listing time. But the import was storing eBay's raw HTML (with double-encoded entities like `&amp;lt;` that single-pass decoding couldn't fully unwind).

**Fix:**
- Added `decodeEntities()` helper that runs a 2-pass decode handling `&lt;`, `&gt;`, `&amp;`, `&quot;`, `&apos;`, `&nbsp;`, numeric `&#NNN;`, and hex `&#xHH;` entities — covers double-encoded eBay content
- Added `htmlToPlain()` helper that strips CDATA wrappers, converts `<br>`/`<div>`/`<p>`/`<li>` to newlines/bullets, removes all remaining HTML tags, and collapses extra whitespace
- Import now stores plain text matching the AI-generated format, so the editor displays it correctly and `toHtmlDescription()` can re-wrap for eBay revise calls
- Extended `[id]/page.tsx` bad-import detection: now also re-imports records whose description still contains `&lt;`, `<div>`, or `<br>` (catches descriptions saved before this fix)

**Files changed:** `app/api/admin/ebay/import-direct/route.ts`, `app/admin/internal-listings/[id]/page.tsx`

---

## 2026-05-26 — Fix: eBay edit listing now pre-fills all form fields and description

**Request:** Card Identity fields (Player/Athlete, Year, Manufacturer, Set, Card Number), autograph fields, and Signed By were showing blank. Description showed raw HTML entities. League wasn't auto-filling from sport.

**Root causes fixed:**

*InternalListingEditor.tsx draft init missing fields:*
- `playerOverride`, `yearOverride`, `manufacturerOverride`, `setOverride`, `cardNumberOverride` — these control Card Identity inputs; were left blank even though card-level data existed
- `signedBy`, `autographAuthentication`, `autographFormat`, `autographAuthNumber` — autograph section inputs left blank
- `autographedEbay` — was not falling back to `e.autographed`, so toggle always showed OFF for autographed cards
- `league` — was storing eBay full name "National Football League (NFL)" but form expects "NFL"; added abbreviation extractor + SPORT_LEAGUE fallback

*import-direct/route.ts:*
- Description stored with raw HTML entities (`&lt;div&gt;`); added CDATA stripping and entity decoding
- `autographedEbay` was never stored; now set to `mapped.autographed` on import
- `league` now normalized to short form (NFL, MLB, etc.) at import time

*[id]/page.tsx + listings/page.tsx:*
- Bad empty-player eBay imports now auto-detected on edit: record is deleted and user is redirected to listings with a notice to click Edit listing again for a clean import

**Files changed:** `InternalListingEditor.tsx`, `import-direct/route.ts`, `[id]/page.tsx`, `listings/page.tsx`

---

## 2026-05-26 — Fix: eBay import-direct route now correctly populates all item specifics

**Request:** Clicking "Edit listing" on a direct eBay listing opens the editor but form fields were all empty.

**Root causes fixed:**
1. Missing `<IncludeItemSpecifics>true</IncludeItemSpecifics>` in GetItem XML request — eBay wasn't returning specifics at all
2. Specifics parsing only captured the first `<Value>` per NameValueList block (bug with `attr()` helper); fixed to iterate all `<Value>` tags so multi-value specifics like "Features" capture every entry
3. Description CDATA block was interfering with specifics regex parsing; fixed by stripping `<Description>...</Description>` before parsing NameValueList blocks
4. Missing "Card Name" mapping → `player` field (fallback for listings using that specific instead of "Player/Athlete")
5. "Graded" boolean was checking for existence of "Professional Grader" value instead of reading `Graded=Yes`; fixed to `get(["Graded"]) === "Yes" || !!(get(["Professional Grader"]))`
6. Added "Country of Origin" alias to `countryOfOrigin` mapping
7. Bad-import recovery: if existing record has empty `player` field, delete and re-import rather than returning the empty record
8. Applied same `IncludeItemSpecifics` + multi-value + CDATA fixes to `direct-listings/[itemId]/route.ts` for consistent inline preview data

**Files changed:** `app/api/admin/ebay/import-direct/route.ts`, `app/api/admin/ebay/direct-listings/[itemId]/route.ts`

---

## 2026-05-26 — Direct eBay listings: Edit listing imports into full InternalListingEditor

**Request:** Clicking "Edit listing" on a directly-listed eBay item should open the same eBay listing form used for consignment/internal listings.

**Completed:**
- Created `app/api/admin/ebay/import-direct/route.ts` — POST with `{ ebayItemId }`, calls GetItem, maps all data (title, description, photos, item specifics → player/year/set/grade/etc, prices, listing type, shipping) into a new InternalListing DB record with status "active" and ebayListingId set; if already imported returns existing record ID
- Updated `ListingsClient.tsx` — "Edit listing" button on each direct eBay listing calls import-direct, then navigates to `/admin/internal-listings/[id]` which opens the full InternalListingEditor pre-populated with all eBay data
- Renamed "View full listing" → "Preview" (now secondary/smaller); "Edit listing" is the primary action
- Once imported, listing moves from "Listed directly on eBay" section to the main Internal listings table (it now has a DB record with ebayListingId set)

**Files changed:** `app/api/admin/ebay/import-direct/route.ts` (new), `app/admin/listings/ListingsClient.tsx`

---

## 2026-05-26 — Internal tab: direct eBay listings merged in with full inline detail view

**Request:** Remove eBay Direct tab. Show direct eBay listings (not tied to a consignment order) in the Internal tab. Full listing view from admin dashboard — no need to visit eBay.com.

**Completed:**
- Removed "eBay Direct" tab button entirely
- Internal tab now loads direct eBay listings from `GetMyeBaySelling` when opened
- Shows them in a "Listed directly on eBay" section below the site-created Internal listings
- Each direct listing has "▼ View full listing" button that calls `GetItem` Trading API and shows inline:
  - Up to 8 card photos
  - Item specifics grid (player, year, grade, etc.)
  - Full description
- End listing button works directly from admin for direct listings
- Internal site-created listings: renamed "View on eBay →" to "View / Edit listing" (links to full InternalListingEditor page)
- Created `app/api/admin/ebay/direct-listings/[itemId]/route.ts` — GetItem API route returning photos, specifics, description

**Files changed:** `app/admin/listings/ListingsClient.tsx`, `app/api/admin/ebay/direct-listings/[itemId]/route.ts` (new)

---

## 2026-05-26 — eBay Direct Listings tab + production environment prep

**Request:** Show listings created directly on eBay in the admin dashboard with full management (end listing). Also switch from sandbox to production.

**Completed:**
- Created `app/api/admin/ebay/direct-listings/route.ts` — calls eBay Trading API `GetMyeBaySelling`, filters out listing IDs already tracked in `EbayListing` or `InternalListing` tables, returns only "direct" listings
- Created `app/api/admin/ebay/end-direct/route.ts` — calls `EndItem` Trading API by eBay item ID (no DB record needed)
- Updated `ListingsClient.tsx` — added "eBay Direct" third tab; loads on tab click; shows Title, eBay #, current price, BIN price, end date; has "View on eBay →" and "End listing" per row
- Fixed date formats to include year in feedback display (`fmtDate` in MessagesClient)
- **Production switch:** Infrastructure is already environment-aware. User needs to: (1) enter production App ID, Cert ID, RuName in API Keys → eBay — Production, (2) click Connect eBay account to OAuth, (3) change ebay_environment to "production"

**Files changed:** `app/api/admin/ebay/direct-listings/route.ts` (new), `app/api/admin/ebay/end-direct/route.ts` (new), `app/admin/listings/ListingsClient.tsx`, `app/admin/ai-lab/messages/MessagesClient.tsx`

---

## 2026-05-26 — Session: SMS alerts, AI text replies, per-account email polling

### eBay Feedback: Persistent DB-backed alerts
- Created `EbayFeedbackAlert` Prisma model (`feedbackId @unique`, nullable `resolvedAt`)
- Created `app/api/admin/ebay/feedback/alerts/route.ts` — GET unresolved / PATCH resolve-by-id
- Updated `MessagesClient.tsx` — banner shows "X unresolved entries require attention"; badge persists until "Mark resolved" is clicked (no more 24-hour window); detail panel has "Mark resolved" button

### Twilio — credentials UI only
- Added Twilio group to credentials SEED (`twilio_account_sid`, `twilio_auth_token`, `twilio_from_number`)
- Kept `lib/twilio.ts` as future SMS/call helper — not used for alerts currently

### Switch feedback alerts from Twilio to email-to-SMS
- Added optional `text?: string` param to `sendTransactionalEmail()` for plain-text gateway delivery
- Monitor route now sends parallel emails: HTML to `mikeahayward@hotmail.com` + plain text to `8604812787@vtext.com` (Verizon SMS gateway)
- Twilio calls removed from alert path

### AI agent SMS two-way conversation
- Updated `lib/email-agent.ts`: `PHONE_GATEWAY_EMAILS` set (`8604812787@vtext.com`, `8604812787@vzwpix.com`)
- Both gateway addresses added to `OWNER_EMAILS` — replies from Mike's phone trigger owner-mode agent
- SMS system prompt: plain text only, no markdown, answer fully
- `splitForSms()`: splits responses > 320 chars at sentence boundary into two sequential texts
- `replyToSender()`: routes to SMS or HTML email based on `viaSms` flag

### Per-account email poll intervals
- Added `pollIntervalSeconds?: number` to `EmailAccount` interface in `card-cloud-ai/lib/email-accounts.ts`
- `card-cloud-ai/lib/email-poller.ts` rewritten: each account gets independent `accountLoop()` setTimeout; re-reads JSON on every cycle so interval changes take effect without restart; eBay checks fixed at 15 min
- `card-cloud-ai/app/api/email/accounts/route.ts` — POST and PATCH both handle `pollIntervalSeconds`
- `EmailDashboard.tsx` — inline "Check every N seconds" editor per account with Save button; minimum 15s enforced
- Removed global `email_poll_interval` from credentials SEED and deleted `app/api/admin/email/poll-interval/route.ts`

**Files changed:** `lib/email-agent.ts`, `lib/transactional-email.ts`, `lib/twilio.ts` (new), `app/api/admin/ebay/feedback/alerts/route.ts` (new), `app/api/admin/ebay/feedback/monitor/route.ts`, `app/admin/ai-lab/messages/MessagesClient.tsx`, `app/admin/ai-lab/email/EmailDashboard.tsx`, `app/admin/credentials/page.tsx`, `card-cloud-ai/lib/email-agent.ts`, `card-cloud-ai/lib/email-accounts.ts`, `card-cloud-ai/lib/email-poller.ts`, `card-cloud-ai/app/api/email/accounts/route.ts`, `card-cloud-ai/.env`

---

## 2026-05-25 22:15 — eBay Messages: Sent tab shows full thread history (all seller messages, not just latest)

**Request:** Sent message from today wasn't showing because buyer replied after the seller.

**Root cause:** The route was filtering by `latestMessage.senderUsername === seller` — this only shows conversations where the seller sent the LAST message. If the buyer replied after, the seller's message was invisible.

**Completed:**
- Discovered `conversation_type` (underscore) is the correct param for the individual thread endpoint (camelCase `conversationType` silently fails — eBay API inconsistency)
- Discovered `limit` max is 50 for the thread endpoint (limit=100 returned 400, which was swallowed)
- Updated route to fetch FULL thread for each conversation and extract ALL messages where `senderUsername === seller`, not just the latestMessage
- Thread endpoint: `GET /commerce/message/v1/conversation/{id}?conversation_type=FROM_MEMBERS&limit=50`
- Each seller message in the thread now gets its own entry in the Sent list, with `inReplyTo` showing the preceding buyer message

**Files changed:** `app/api/admin/ebay/messages/route.ts`

---

## 2026-05-25 21:30 — eBay Messages: Sent tab now pulls real sent messages from eBay REST API

**Request:** Sent tab was empty (local DB only); needed messages sent directly on eBay.com to also appear.

**Completed:**
- Discovered eBay Commerce Message REST API endpoint: `GET https://api.ebay.com/commerce/message/v1/conversation` (released Q4 2025, uses `commerce.message` OAuth scope)
- Updated `app/api/admin/ebay/messages/route.ts` to call the REST API in addition to Trading XML API; filters `FROM_MEMBERS` conversations where `latestMessage.senderUsername === seller`; maps to `EbaySentMessage[]` with `source: "ebay"`
- Added `source: "ebay" | "local"` field to `EbaySentMessage` interface
- Added fallback: if seller username is null in DB, derives it from most-common `recipientUsername` in conversations
- Fixed `ebay_seller_username_prod` DB credential — was empty string, now set to "haywardsys"
- Updated `MessagesClient.tsx` to show "From eBay" / "Sent via dashboard" badge on each sent message
- Merged eBay-sourced and local-DB sent messages, sorted by date

**Files changed:** `app/api/admin/ebay/messages/route.ts`, `app/admin/ai-lab/messages/MessagesClient.tsx`

---

## 2026-05-25 19:00 — eBay Messages: in-app reply, sender bug fix, status badges

**Request:** Reply to eBay messages directly from the Card Cloud admin dashboard instead of redirecting to eBay.

**Completed:**
- Created `app/api/admin/ebay/messages/reply/route.ts` — POST endpoint using eBay Trading API `AddMemberMessageRTQ`; accepts `messageId`, `itemId`, `body`, `recipientId`; returns `{ ok: true }` or `{ error }`
- Fixed sender bug in `messages/route.ts` — was reading `<UserID>` (seller ID from `<Seller>` element); now reads `<SenderID>` from `<Question>` (the buyer's username)
- Added `status` field to `EbayMessage` interface — reads `<MessageStatus>` (Unanswered / Answered)
- Updated `MessagesClient.tsx`: reply textarea + Send Reply button replace the "Reply on eBay" redirect; shows amber "Needs reply" / green "Replied" badge per message; clears compose box and refreshes list after successful send; pre-existing "Open on eBay ↗" link retained as fallback

---

## 2026-05-25 18:00 — eBay Messages: connected production account + fixed auth/loading bugs

**Request:** eBay Messages tab showing auth error, then stuck loading, then showing no messages despite real messages existing on eBay.

**Completed:**
- Fixed hardcoded `TRADING_API_URL` in both `messages/route.ts` and `messages/monitor/route.ts` — replaced with `getTradingApiUrl()` from ebay-auth (environment-aware: sandbox vs production)
- Fixed infinite re-fetch loop in `MessagesClient.tsx` — `useEffect` was re-triggering on every render when inbox was empty because `ebayMsgs.length === 0` stayed true; added `ebayLoaded` flag to gate the initial load
- Started new Cloudflare tunnel (`generate-mixing-surrey-mercury.trycloudflare.com`) — old tunnel had expired
- Updated `EBAY_DELETION_ENDPOINT_URL` in `.env` to new tunnel URL
- Updated eBay developer portal production keyset with new OAuth callback and marketplace deletion URLs
- Completed production eBay OAuth — production access token now stored as `ebay_access_token_prod`
- Set `ebay_environment` SiteCredential to `production` via tsx script — API now calls `api.ebay.com` and returns real messages (3 found)

---

## 2026-05-25 — eBay Messages: admin inbox + AI monitoring + alert emails

**Request:** Fetch eBay messages and show them in the admin dashboard under AI Lab → Messages with a toggle between support email and eBay messages. Have the AI agent monitor eBay messages and email mikeahayward@hotmail.com with a summary and action items when anything needs attention. No auto-replies for now.

**Completed:**
- `lib/ebay-auth.ts` — Added `getAppId()` export for Trading API header use
- `lib/email-agent.ts` — Changed `ADMIN_EMAIL` default from `virus860@gmail.com` to `mikeahayward@hotmail.com` (all escalations now go there)
- `app/api/admin/ebay/messages/route.ts` — GET endpoint: calls eBay Trading API `GetMemberMessages`, parses XML response, returns JSON array of messages (last 30 days, up to 40). Uses existing base OAuth scope — no re-authorization needed.
- `app/api/admin/ebay/messages/monitor/route.ts` — POST endpoint called by card-cloud-ai every 5 min. Fetches messages since last check (timestamp stored in SiteCredential as `ebay_message_last_check`), runs each through Claude Haiku with eBay policy system prompt, emails `mikeahayward@hotmail.com` with a priority-sorted alert if any messages need action. Protected by `x-internal: ai-lab` header.
- `app/admin/ai-lab/messages/page.tsx` + `MessagesClient.tsx` — New Messages page under AI Lab with a tab toggle: **Support Email** (shows email threads from DB, links to Email Agent for full view) | **eBay Messages** (fetches live from eBay API, shows sender, type badge, unread indicator, item link, full message body in detail panel with "Reply on eBay" button)
- `app/admin/layout.tsx` — Added "Messages 💬" nav link under AI Lab section
- `card-cloud-ai/lib/email-poller.ts` — Added `checkEbayMessages()` call to `pollOnce()` — eBay monitoring runs on the same 5-minute cycle as email polling, no extra process needed

**Architecture note:** All eBay auth/API logic stays in the main app. card-cloud-ai calls `POST /api/admin/ebay/messages/monitor` with `x-internal: ai-lab` header, same pattern as the email inbound endpoint.

---

## 2026-05-24 18:15 — Wired rejection guidance into photo straightener

**Request:** When the photo straightener detects a bad photo, return the rejection reason and a plain-English tip telling the user how to fix it.

**Completed:**
- Added `REJECTION_GUIDANCE` map in `app/api/admin/photo-fix/route.ts` — 8 reasons, each with a one-sentence fix tip
- Extended `PASS1_PROMPT` to detect rejection conditions and return `{ "type": "rejected", "reason": "Blurry" }` (and 7 other reasons)
- Updated `Pass1` interface: added `type: "rejected"` and `reason?: string`
- Updated `processImage()` return type: `buffer` is now optional; added `rejected`, `reason`, `guidance` fields
- Added rejection short-circuit: when Pass 1 returns `type: "rejected"`, processing stops immediately and returns reason + guidance (no Claude Pass 2, no warp)
- Updated route handler to pass `rejected`, `reason`, `guidance` through to the API response; `result` is omitted for rejected photos
- Updated `PhotoFixClient.tsx`: new `rejected`, `reason`, `guidance` fields on `PhotoResult` interface
- Added red rejection card UI: red border/header, `BlockIcon`, reason badge pill, guidance text panel, original photo displayed below so the user can see what was wrong
- Results summary line now shows "· N rejected" in red when any rejections occur
- Fixed pre-existing bug: `sourcePath` was used in `roughLocation()` but missing from `TrainingExample` interface and Prisma select — added to both

---

## 2026-05-24 17:25 — Reverted rejects to standard folder structure; description.txt is sole accept/reject authority

**Request:** No special rejects folder. All photos — including rejected ones — stay in their normal category folder (e.g. graded_bgs\front\Bo Jackson\). description.txt determines accept/reject. Scan reads description.txt first before checking for image files.

**Completed:**
- Removed `rejects` from `VALID_CATEGORIES` — no special rejects folder needed
- Reverted to single 4-level structure for all categories: `[category]\[face]\[card_name]\`
- Scan now reads `description.txt` first, then decides whether `after.jpg` is required
- If `Rejected:` found in description.txt → only `before.jpg` needed; model learns what bad photos look like
- If `Accepted:` found → both `before.jpg` and `after.jpg` required as before
- `beforeThumb` stored as `afterThumb` for rejected samples so the model sees the bad photo paired with its rejection label
- Documented all 8 rejection reasons in the route header comment:
  Multiple cards, Card obscured, Too far away, Extreme angle, Blurry, Glare covering card, Wrong subject, Already cropped
- Updated `app/api/admin/photo-training/scan/route.ts`

**Future task noted:** After training is complete, the photo straightener should return the rejection reason AND a plain-English tip telling the user how to fix it (e.g. "Too far away → Move the camera closer to the card"). This will be used in the consignment upload flow to guide sellers.

---

## 2026-05-24 17:10 — Updated photo training scan: rejects folder structure + description.txt determines accept/reject

**Request:** Rejects should live at `C:\cardtraining\rejects\[descriptive_name]\` (no face subfolder). Accept/reject should be determined by the `Accepted:`/`Rejected:` line in description.txt, not the folder name.

**Completed:**
- Updated `app/api/admin/photo-training/scan/route.ts` with two-path scanning logic:
  - `rejects` category: 3-level structure (`rejects\[descriptive_name]\`), face stored as `"none"`, no `after.jpg` ever expected, `sourcePath = rejects/none/descriptive_name`
  - All other categories: 4-level structure unchanged, but `isRejected()` now reads description.txt instead of checking folder name
- Added `isRejected(description)` helper — checks if any line starts with `Rejected:` (case-insensitive)
- Any photo in any category can now be marked rejected via its description.txt — no `after.jpg` needed, `beforeThumb` used as `afterThumb`
- Ran `npx prisma generate` to fix pre-existing Prisma client type errors for `photoTrainingSample`

---

## 2026-05-24 09:00 — Created Claude Changelog system in admin dashboard

**Request:** Create a changelog stored in the admin log section that documents everything Claude does.

**Completed:**
- Created `CLAUDE_CHANGELOG.md` at project root — append-only markdown file Claude writes to after every task
- Created `app/api/admin/changelog/route.ts` — reads and parses the markdown file into structured JSON
- Created `app/admin/logs/ChangelogClient.tsx` — color-coded gallery UI with expandable entries per section type
- Updated `app/admin/logs/page.tsx` — added tab switcher between System Logs and Claude Changelog
- Changelog is visible at Admin → Logs → Claude Changelog

---

## 2026-05-24 09:30 — Created CardCloud_SessionNotes.docx on Desktop

**Request:** Create a Word document covering every feature, bug, decision, env var, schema change, integration, and next step — structured so a new Claude session can continue the project without needing input from Mike.

**Completed:**
- Created `CardCloud_SessionNotes.docx` on Desktop with 15 sections
- Section 0: New Session Quick Start (first thing to read)
- Section 1: Memory system — every memory file explained with its full rules
- Sections 2–15: Tech stack, PM2, env vars, schema, features built, bugs, architecture decisions, photo training framework, integrations, known issues, next steps, admin map, UI decisions, changelog system
- Document is structured in reading order for a new session, not by topic

---

## 2026-05-24 10:00 — Created CardCloud_SiteOverview.docx on Desktop

**Request:** Create a second Word document explaining the site in a way a human can understand — no technical jargon.

**Completed:**
- Created `CardCloud_SiteOverview.docx` on Desktop with 14 sections
- Covers: what the platform is, the four services (Track, Direct Sell, Consignment, Trade), the public website, the admin dashboard, the AI photo tools, eBay connection, accounts and login, pricing with plain examples, PSA integration, what's built vs coming, day-to-day operations, hosting in plain English, sports categories, and key owner takeaways
- Written for a non-technical reader — no file paths, no code, no jargon

---

## 2026-05-24 10:15 — Fixed done notification (popup → system tray balloon)

**Request:** Stop creating a popup on screen when work is done. Use a system tray balloon notification instead.

**Completed:**
- Identified the wrong method being used: `Wscript.Shell.Popup()` creates a modal dialog that blocks the screen
- Updated memory (`feedback_notifications.md`) to explicitly ban `Wscript.Shell.Popup()` and document the correct command
- Correct method: `NotifyIcon.ShowBalloonTip()` via `System.Windows.Forms` — appears in system tray, auto-dismisses

---

## 2026-05-24 10:30 — Updated SessionNotes to include memory system and changelog documentation

**Request:** Update the Word document so a new session can easily continue the project. Include the memory system and anything else that would help.

**Completed:**
- Rebuilt `CardCloud_SessionNotes.docx` from scratch with better structure
- Added Section 0 (Read This First) with three sources of truth, day-one checklist, and non-negotiable rules
- Added Section 1 (Memory System) documenting every memory file, its location, and its full content
- Reordered all sections in the order a new session would actually use them
- Added balloon notification command and 900K token warning to the document

---

## 2026-05-24 10:45 — Established real-time changelog and Word doc update rules

**Request:** Update the changelog after every task (not just sessions). Update the Word docs when major changes happen.

**Completed:**
- Updated `feedback_changelog.md` memory with per-task logging rule (write immediately after each task, not at session end)
- Added Rule 2 to memory: update `CardCloud_SessionNotes.docx` for technical changes, `CardCloud_SiteOverview.docx` for user-facing changes
- Updated `CLAUDE_CHANGELOG.md` header and format to reflect per-task entries with timestamps
- Updated `CardCloud_SessionNotes.docx` Section 15 with Word document update rules

---

## 2026-05-24 11:00 — Updated changelog workflow to per-task with date and time

**Request:** Changelog should be updated after every task completes — one entry per task with date, time, what was asked, and what was done.

**Completed:**
- Updated `feedback_changelog.md` memory to define the per-task format with timestamp (YYYY-MM-DD HH:MM)
- Updated `CLAUDE_CHANGELOG.md` header to reflect new format
- Reformatted all previous today's entries into the new per-task style
- Updated `CardCloud_SessionNotes.docx` with the revised changelog rules

---

## 2026-05-24 — Photo Training System, eBay Integration, Landing Page & CMS

**Summary:** Built the photo training data pipeline, eBay marketplace deletion endpoint (required for production keyset approval), training image collection scripts, landing page sports makeover, complete set of public pages, and the admin CMS content system.

### Features Built
- Photo Training System — 4-level folder scanner (`C:\cardtraining\[category]\[face]\[card_name]\`), thumbnail generation via Sharp, brightness-based card center estimation, DB import with dedup via `sourcePath`
- Photo Training Gallery — Admin → AI Lab → Photo Training; category/face/diagnosis badges, descriptor properties panel, before/after images, reference template for `description.txt`
- Photo Straightener — Two-pass Claude detection (rough % location → precise 4-corner), homography perspective warp (DLT algorithm), glare removal, EXIF-aware rotation
- eBay OAuth — Sandbox and production environment support; tokens stored with `_prod` suffix for production; Connect buttons embedded in Admin → API Keys
- eBay Marketplace Deletion Endpoint — GET SHA-256 challenge verification + POST account deletion handler; required for eBay production keyset approval
- Training Image Collection Scripts — `scripts/collect-training-images.ts`, `collect-raw-cards.ts` (100+ queries, 3-per-query cap), `collect-backs.ts` (uses item detail endpoint for back images)
- Landing Page — Sports hero with gradient + field-line pattern, real sports card graphic (Trout, Rodgers, LeBron, Messi, Griffey), sport category strip, pricing strip
- Card Cloud Logo — SVG: three amber/gold playing cards fanning below a white cloud
- Footer — Platform + Company columns, social icons, added to all public pages
- Public Pages — `/terms` (17 sections), `/privacy` (11 sections), `/faq` (accordion), `/support`, `/about`, `/pricing`, `/contact`
- Admin CMS — Tabbed editor: Landing Page, Service Cards, How To, Support, FAQ, Terms, Privacy, Pricing; slot types: text, url, toggle, blocks, faq, terms-sections, privacy-sections
- Admin Links & Buttons — Inline "Add item to this section" at bottom of every section; eBay sections moved here from Settings

### Files Created / Modified
- `app/api/admin/photo-training/scan/route.ts` — New
- `app/api/admin/photo-training/route.ts` — New (GET + DELETE)
- `app/api/admin/photo-fix/route.ts` — Major update (two-pass Claude, homography warp, glare removal)
- `app/admin/ai-lab/photo-training/PhotoTrainingClient.tsx` — New
- `app/admin/ai-lab/photo-training/page.tsx` — New
- `app/admin/ai-lab/photo-fix/PhotoFixClient.tsx` — Updated
- `lib/ebay-auth.ts` — Added env parameter to `buildAuthUrl` and `exchangeCode`
- `app/api/ebay/authorize/route.ts` — Added `?env=` support
- `app/api/ebay/callback/route.ts` — Reads stored env, redirects to `/admin/credentials`
- `app/api/ebay/marketplace-deletion/route.ts` — New (GET challenge + POST handler)
- `app/admin/credentials/CredentialsClient.tsx` — Added eBay connect buttons + status display
- `app/admin/settings/SettingsClient.tsx` — Removed eBay panel, added redirect notice
- `components/landing/SiteFooter.tsx` — New
- `components/landing/Hero.tsx` — Sports makeover
- `components/landing/CardGraphic.tsx` — Real sports cards
- `components/landing/SportsCategoryStrip.tsx` — New
- `components/landing/PricingStrip.tsx` — New
- `components/brand/CardCloudLogo.tsx` — New SVG logo
- `app/(public)/terms/page.tsx` — New
- `app/(public)/privacy/page.tsx` — New
- `app/(public)/faq/page.tsx` — New
- `app/(public)/support/page.tsx` — New
- `app/(public)/about/page.tsx` — New
- `app/(public)/pricing/page.tsx` — New
- `app/(public)/contact/page.tsx` — New
- `app/admin/content/page.tsx` + `ContentClient.tsx` — New
- `lib/terms-defaults.ts` — New (pre-written ToS)
- `lib/privacy-defaults.ts` — New (pre-written Privacy Policy)
- `app/admin/links/LinksClient.tsx` — Added inline Add button + Social Media section
- `scripts/collect-training-images.ts` — New
- `scripts/collect-raw-cards.ts` — New
- `scripts/collect-backs.ts` — New

### Bugs Fixed
- **EXIF rotation (90° cards)** — Added `sharp().rotate()` at the very start of the photo-fix pipeline before any processing
- **Photo straightener returning original** — Switched to two-pass Claude system with few-shot before/after examples in the prompt; Claude was detecting background instead of card
- **Card always at top of crop** — Claude reported label as center; fixed with topY/botY/centerX approach + physics sanity check on height
- **eBay deletion endpoint URL mismatch** — `NEXTAUTH_URL` pointed to localhost but eBay required the registered HTTPS URL; fixed with dedicated `EBAY_DELETION_ENDPOINT_URL` env var
- **eBay `-keyword` exclusions not working** — eBay Browse API does not support `-keyword` query syntax; removed exclusions, replaced with client-side post-filtering
- **Prisma data loss warning on migration** — Used `--accept-data-loss` flag for `prisma db push`
- **DB idle errors** — PGlite idles out after inactivity; workaround: `pm2 restart card-cloud-db` + wait 20s

### Schema Changes
- Added `PhotoTrainingSample` model — fields: `id`, `beforeThumb`, `afterThumb`, `cx`, `cy`, `category`, `description`, `sourcePath` (unique), `createdAt`; index on `[category, createdAt]`; table name `photo_training_samples`
- Migration applied with: `npx prisma db push --accept-data-loss`

### Environment Variables Added
- `EBAY_DELETION_VERIFICATION_TOKEN` — SHA-256 verification token for eBay marketplace deletion
- `EBAY_DELETION_ENDPOINT_URL` — Must match URL registered in eBay developer portal exactly

### Third-Party Services Configured
- eBay Browse API (production) — App ID: `MichaelH-CardClou-PRD-22ed07085-28abc59c`; production keyset approved after implementing marketplace deletion endpoint
- Cloudflare Tunnel — Temporary HTTPS exposure (`instruments-quest-franchise-direction.trycloudflare.com`) used to verify eBay deletion endpoint

### Decisions Made
- Two-pass Claude detection: Pass 1 = rough % location (400px thumbnail), Pass 2 = precise 4-corner (zoomed crop) — reduces hallucination from small-card-in-large-image problem
- Homography warp over simple rotation — handles camera tilt and keystoning, not just flat rotation
- Training `description.txt` uses concrete pixel measurements (Borders: Left 45px / Right 180px / Top 92px / Bottom 210px) rather than subjective labels
- eBay env suffix pattern: production tokens stored with `_prod` suffix, sandbox without — allows both to coexist in same DB table
- Rejects as a first-class category — teaches the model what NOT to attempt

### Known Issues / Debt Left
- Photo straightener accuracy still inconsistent without training data — training system is the long-term fix
- Cloudflare tunnel URL is temporary — needs permanent hosting before production eBay launch
- eBay production OAuth token exchange not yet completed (infrastructure ready, tokens not obtained)
- DB idle workaround is manual — proper fix is connection keepalive or hosted Postgres

---
## 2026-05-26 — eBay Feedback persistent alerts + Twilio credentials

### New files
- pp/api/admin/ebay/feedback/alerts/route.ts
  - GET: returns all unresolved EbayFeedbackAlert records (resolvedAt === null)
  - PATCH: marks a specific alert resolved by id (sets resolvedAt = now)

### Modified files
- pp/admin/ai-lab/messages/MessagesClient.tsx
  - Loads unresolved alerts from /api/admin/ebay/feedback/alerts on mount (independent of feedback tab)
  - Badge and banner now reflect persistent DB alerts, not a 24-hour time window
  - Banner text updated: "X unresolved negative feedback entries require your attention"
  - Added "Mark resolved" button in detail panel for Negative/Neutral entries
  - Marking resolved removes the entry from the unresolved count immediately (optimistic UI)

- pp/admin/credentials/page.tsx
  - Added Twilio group to SEED: twilio_account_sid, twilio_auth_token, twilio_from_number
  - Added "Twilio" to GROUP_ORDER

## 2026-05-26 — Switch alerts from Twilio to email-to-SMS; remove phone calls

**Request:** Drop phone call alerts (costs money). Text via Verizon email-to-SMS gateway instead of Twilio.

**Completed:**
- Removed makeCall and sendSms (Twilio) from feedback monitor
- Added ALERT_SMS_EMAIL = "8604812787@vtext.com" (Verizon gateway)
- Monitor now fires two emails in parallel: HTML alert to mikeahayward@hotmail.com + plain text to vtext.com gateway
- Updated sendTransactionalEmail to accept optional `text` param (passed to nodemailer + Resend for plain-text delivery)
- Updated test-notifications endpoint to send via email-to-SMS and verify SMTP response
- Test confirmed: SMTP accepted, "250 Message received", delivered to 8604812787@vtext.com
- Twilio credentials remain in API Keys for future use; lib/twilio.ts unchanged

---
## 2026-05-26 — AI agent responds to Mike via SMS (text through email)

**Request:** Update the email agent so Mike can text support@thecardcloud.com and get a reply back as a text message. Agent should recognize his Verizon number and respond SMS-style.

**Completed:**
- Added PHONE_GATEWAY_EMAILS set to lib/email-agent.ts: 8604812787@vtext.com and 8604812787@vzwpix.com (SMS + MMS Verizon gateways)
- Added both gateway addresses to OWNER_EMAILS so texts are treated as owner messages, not customer emails
- Added OWNER_SMS_REPLY_TO = "8604812787@vtext.com" constant
- Updated buildOwnerAgentSystem() to accept viaSms param — when true, adds SMS mode instruction: keep reply under 3 sentences, no markdown/bullets, conversational tone
- Added replyToSender() helper: sends plain text to vtext.com gateway if viaSms, otherwise sends HTML email to fromEmail as before
- Normalized subject to "SMS from Mike" for gateway-originated threads (Verizon sends blank/garbled subjects)
- Updated "no AI key" fallback to send short SMS-friendly message when viaSms
- How it works: Mike replies to any agent-sent text → Verizon forwards reply to support@thecardcloud.com → IMAP poller picks it up → agent recognizes @vtext.com as owner → responds via SMS → loop continues

Files changed:
- lib/email-agent.ts

---
## 2026-05-26 — Email poller 1 min; SMS responses uncapped + auto-split

**Request:** Poll every 1 minute instead of 5. Remove 3-sentence SMS limit. Split long replies into two texts.

**Completed:**
- card-cloud-ai/.env: EMAIL_POLL_INTERVAL_MS changed from 300000 to 60000
- card-cloud-ai/lib/email-poller.ts: default fallback also updated to 60000
- lib/email-agent.ts: removed 3-sentence cap from SMS mode prompt; Claude now answers fully
- lib/email-agent.ts: added splitForSms() — splits at sentence boundary near midpoint if > 320 chars
- lib/email-agent.ts: replyToSender() sends parts sequentially so they arrive in order
- Confirmed: poller logs "polling every 60s" after restart

---
## 2026-05-26 — Inbox poll interval setting + memory fixes (minimized windows, balloon vs dialog)

**Request:** Add admin setting for email check frequency. Remember to use balloon notifications (not MessageBox). Remember to start spawned windows minimized.

**Completed:**
- Added email_poll_interval credential to app/admin/credentials/page.tsx SEED (Email — SMTP group, hint: min 15s, default 60)
- Created app/api/admin/email/poll-interval/route.ts — returns { intervalMs, intervalSeconds } from DB credential
- Updated card-cloud-ai/lib/email-poller.ts: replaced fixed setInterval with recursive setTimeout that re-reads interval from API before each cycle (live config — no restart needed after changing the setting)
- Updated memory: feedback_notifications.md — explicitly bans MessageBox and Wscript.Shell; only NotifyIcon balloon allowed
- Created memory: feedback_minimized_windows.md — all spawned windows must use -WindowStyle Hidden or Minimized
- Updated MEMORY.md index

---

---

## 2026-05-28 — Production deployment prep: Cloudflare R2, Railway start command, DEPLOY.md runbook

**Goal:** wire the app for first production deploy on Railway with hosted Postgres + Cloudflare R2 photo storage. No code changes required to switch between local dev and prod — env vars decide.

**Cloudflare R2 client (`lib/r2.ts`, new):**
- S3-compatible PutObjectCommand wrapper using `@aws-sdk/client-s3`.
- Endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`.
- `r2Configured()` returns true only when all 5 env vars are present (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`).
- `uploadToR2({key, body, contentType})` returns the public URL the browser can load.
- Cached `S3Client` (one per process).

**Upload route now switches on env (`app/api/upload/route.ts`):**
- If R2 is configured: stream the buffer to R2, return `{ url: "<R2_PUBLIC_URL>/uploads/<hash>.jpg" }`.
- Otherwise: keep writing to `./public/uploads/` on the local filesystem (local dev unchanged).
- The form code that calls this endpoint never has to know which path was used — response shape is identical.

**Prisma migration history bootstrapped:**
- Generated `prisma/migrations/20260528120000_init/migration.sql` via `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` — 36 CREATE TABLE statements, ~34 KB.
- Added `prisma/migrations/migration_lock.toml` with `provider = "postgresql"`.
- Marked the initial migration as already-applied against the local PGlite DB via `prisma migrate resolve --applied 20260528120000_init` (so local dev keeps using existing tables without trying to re-create them).
- Production: `prisma migrate deploy` runs on every Railway start (see below) and creates the schema from scratch on first deploy.

**Railway start command (`package.json`):**
- Added `postinstall: "prisma generate"` so Prisma Client builds against the production Postgres on every Railway install.
- Added `start:prod: "npx prisma migrate deploy && next start"` — runs pending migrations, then boots Next.js. Railway sets `$PORT` which `next start` respects natively.

**`railway.json` (new):**
- Builder: NIXPACKS (Railway auto-detects Next.js).
- Start command: `npm run start:prod`.
- Healthcheck: `GET /api/health` with 60 s timeout.
- Restart policy: ON_FAILURE, max 3 retries.

**Healthcheck route (`app/api/health/route.ts`, new):**
- `GET /api/health` runs `SELECT 1` through Prisma. Returns `{ ok: true }` on success, 503 with the error message on failure. Force-dynamic so it's not cached.

**`.env.example` rewritten:**
- Documents every env var actually referenced in the code (greped `process.env.*` across the repo). New sections for `NEXT_PUBLIC_BASE_URL` / `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAIL`, Cloudflare R2 (5 vars + a commented `CLOUDFLARE_R2_*` set used by `lib/training.ts`), eBay marketplace deletion endpoint, `EMAIL_WEBHOOK_SECRET`, `RECEIVE_TOKEN_SECRET`, `AI_LAB_URL`, `OLLAMA_URL`, `SUPPORT_FROM`.
- Switched the default email preset to SMTP (matches Mike's preference) — Resend is commented as a fallback.

**`DEPLOY.md` runbook (new):**
- Step-by-step browser walkthrough for: Cloudflare R2 bucket + API token, Railway project + Postgres add-on + env vars paste-in, Google OAuth allowlist update for the Railway URL.
- "How a deploy works" section explaining the postinstall -> build -> migrate -> start sequence.
- Smoke test checklist (landing, /api/health, Google sign-in, photo upload pointing at R2).
- Custom-domain cutover section saved for after the Railway URL is healthy — DNS-later approach so we don't disrupt the currently-live GoDaddy site.
- Rollback guidance: redeploy a known-good Railway build; never `migrate reset` against prod, always roll forward with a new migration.

**Why R2 vs S3:** R2 has free egress, S3-compatible API, integrates cleanly with Cloudflare's CDN/custom domain. Cheaper at scale. Mike's preference: build for many users from day one rather than swap to a bigger solution later.

**Why Railway vs Vercel:** persistent runtime (Vercel serverless cold-starts hurt with Prisma + heavy initial bundle), one-click Postgres, predictable pricing. Vendor-swappable — nothing in the code is Railway-specific.

**Files changed:**
- `lib/r2.ts` (new)
- `app/api/upload/route.ts`
- `app/api/health/route.ts` (new)
- `prisma/migrations/20260528120000_init/migration.sql` (new)
- `prisma/migrations/migration_lock.toml` (new)
- `package.json`
- `railway.json` (new)
- `.env.example`
- `DEPLOY.md` (new)
- `package-lock.json` (+ `@aws-sdk/client-s3` added)

**Still to do:** Mike walks through Railway signup + R2 bucket creation, pastes env vars, first deploy, smoke test. Custom domain cutover happens later.

---

## 2026-05-28 — Watcher count on active eBay listings

Added "👁 N watching" badge under the price column on the admin eBay listings page for every active listing (consigned, internal, AND direct).

**Data source:** eBay already returns `<WatchCount>` per item in the existing `GetMyeBaySelling` Active List response — no new API call needed. Picks up the same 1-minute cache that powers live bid counts.

**Files:**
- `lib/ebay-live-prices.ts`: added `watchCount` to `LivePrice` interface, parse it from XML.
- `app/admin/listings/page.tsx`: serialize `watchCount` into both consigned + internal listing rows.
- `app/admin/listings/ListingsClient.tsx`: extend `Listing` / `InternalListing` / `DirectListing` interfaces, render the badge under price (only when watchers > 0 AND status is active).
- `app/api/admin/ebay/direct-listings/route.ts`: parse + return `watchCount` for direct listings.

**UX:** small grey 👁 N watching line under the price/BIN/sold prices. Hover tooltip says "Watchers on eBay". Suppressed when 0 watchers or non-active status (no point showing 0 on a sold listing).

Updated CLAUDE_CHANGELOG.md, CardCloud_SessionNotes.docx, and CardCloud_SiteOverview.docx.
---

## 2026-05-28 — Remaining time on active eBay listings

Added a ticking "Nd Nh left" countdown to each active listing's "Listed" column on the admin eBay listings page (consigned, internal) and to the "Ends" column on direct listings.

**Data source:** the existing `GetMyeBaySelling` Active List response already includes `<EndTime>` per item. Threaded through `lib/ebay-live-prices.ts` -> `app/admin/listings/page.tsx` serialization -> `ListingsClient.tsx`. Shares the same 1-minute cache as bid and watcher counts.

**Formatting helper** (`timeLeft(endTime, now)` in `ListingsClient.tsx`):
- > 24h → `Nd Nh left`
- 1-24h → `Nh Nm left`
- 1-59m → `Nm left`
- < 1m → `ending soon`
- past EndTime → `ended`

**Ticking countdown:** added a `now` useState in `ListingsClient` that bumps every 30s; `timeLeft()` takes `now` as a parameter so every row re-renders with the same fresh clock. No new network calls — only the displayed text changes.

**Suppressed for:** non-active listings on consigned/internal sections (no point counting down on a sold/scheduled row). Direct listings always show the countdown if `endTime` is set.

Updated CLAUDE_CHANGELOG.md, CardCloud_SessionNotes.docx, and CardCloud_SiteOverview.docx.