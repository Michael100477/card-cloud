$ErrorActionPreference = "Stop"

$sessionNotesPath = "C:\Users\mikea\OneDrive\Desktop\CardCloud_SessionNotes.docx"
$siteOverviewPath = "C:\Users\mikea\OneDrive\Desktop\CardCloud_SiteOverview.docx"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    # ── Session Notes ────────────────────────────────────────────────
    $sn = $word.Documents.Open($sessionNotesPath)
    $r = $sn.Content
    $r.Collapse(0)

    $entries = @(
        @{
            Date  = "2026-06-12"
            Title = "Lot listings — full UX cleanup end-to-end"
            Body  = "A real-world day of selling lots exposed a chain of issues. Toggling 'This listing is a lot of multiple cards' now also patches package dimensions to 11x6x1 (typical bubble mailer), Item condition to 'Used', and the eBay category to the correct LEAF id 261329 — the previous 183444 turned out to be an intermediate node, not a real leaf, which is why labels and conditions kept getting rejected. The Condition section was overhauled: for lots, only a simple New / Used dropdown shows (with eBay's exact verbatim descriptions, matching what eBay's own listing UI shows), and all the graded/ungraded singles fields are hidden. The Cards Included in the Lot textarea is now optional — sellers don't always have a full list, and when empty the description generator falls back to writing a generic lot description from the photos and other details. The lot description AI prompt was tightened to reproduce every line of the seller's list verbatim. Also: graded toggle no longer clobbers lot dimensions back to 10x4x1; autograph toggle bumps dimensions to 11x6x1; raw cards now default to 'Excellent' condition."
        },
        @{
            Date  = "2026-06-12"
            Title = "Settings — Shipping section now sets new-listing defaults"
            Body  = "Renamed 'Shipping costs' to 'Shipping' in the Rates tab and added a new 'Default shipping type for new listings' dropdown at the top with three options: Flat / Calculated / Free. When set to Flat, every new internal listing comes up with shippingCostType pre-filled to 'Flat rate' and the cost-the-buyer-pays pre-filled with the Bubble Mailer Min Cost value from the same section. Free turns on the freeShipping toggle. Calculated leaves eBay to quote per buyer ZIP. One setting, no per-listing setup needed."
        },
        @{
            Date  = "2026-06-12"
            Title = "Scheduling bug — listings were publishing immediately instead of waiting"
            Body  = "Toggling 'Schedule this listing for 10 PM' was making the listing publish immediately. Two compounding bugs: (1) the date/time pickers in the schedule widget initialized with default values as local state but never committed them to the draft unless the user actually touched a picker, so the save logic saw an empty scheduledTime; (2) the List on eBay button wasn't calling Save first, so even after toggling scheduling, the publish endpoint read the old DB row that didn't have scheduledTime. Fix: toggling Schedule on now auto-commits the displayed default time to the draft immediately, AND List on eBay always saves the draft before publishing. Combined: scheduling actually works now and eBay receives the listingStartDate field as intended."
        },
        @{
            Date  = "2026-06-12"
            Title = "Combined-order shipping — multi-item orders ship under ONE label"
            Body  = "When the same eBay buyer purchases multiple cards in one order, the Shipping admin page was showing each item as its own row with its own Create Label button — inconsistent with the Waiting to be Shipped tab on eBay Listings, which already grouped them. Now the Shipping page groups rows by ebayOrderId: amber 'Combined order — N items' banner, sum of weights, max of per-axis dimensions, total sale across items, and one 'Create label (N items)' button. The create-label backend loads ALL paid siblings sharing the order ID, buys ONE EasyPost label sized for the combined package, marks every sibling shipped with the same tracking, and splits postage cost evenly across siblings so the per-item net profit on the Payout tab still reflects each card's actual share. The Print Label link now points at the formatted /print/label route so combined labels print correctly on the bottom-half-sticker paper layout."
        },
        @{
            Date  = "2026-06-12"
            Title = "Mark as shipped now captures tracking number from eBay seller hub or anywhere else"
            Body  = "For shipments bought outside Card Cloud (eBay seller hub directly, Pirate Ship, whatever) the 'Mark as shipped' button now prompts the admin to paste the tracking number plus the carrier (USPS pre-filled). The tracking + carrier are saved to every sibling row in the combined-order group. The Shipped tab then shows the tracking as a clickable link to the carrier's tracking page just like Card Cloud-bought shipments. End result: the admin can ship through eBay's seller hub for the next few weeks until shipping API access is approved, and Card Cloud still has the right data."
        },
        @{
            Date  = "2026-06-12"
            Title = "Background sync — every 5 minutes automatically, plus manual Refresh button"
            Body  = "Card Cloud now auto-syncs with eBay every 5 minutes in the background regardless of whether anyone is browsing the admin site. Implemented via Next.js's instrumentation.ts startup hook: fires one sync 10 seconds after container boot (so fresh Railway deploys are immediately current), then a recurring sync every 5 minutes. Covers all three eBay APIs Card Cloud uses: Fulfillment (orders, payment status, shipping status, tracking), SoldList (listings that ended), and Finances (payout amounts per order for the Payout tab). Separately, a new 'Refresh from eBay' button next to '+ Create new label' on the Shipping page lets the admin force an immediate sync (e.g., right after manually shipping through eBay seller hub) without waiting for the next 5-minute tick. Bypasses the 60-second throttle. The background sync gracefully skips on Edge runtime and during Next.js production builds."
        },
        @{
            Date  = "2026-06-12"
            Title = "Finances API debugging — root cause was a single-character subdomain difference"
            Body  = "Spent significant time debugging why the eBay Finances API kept returning 404 with empty body. Suspected OAuth scope issue: revoked the Card-Cloud app on accounts.ebay.com/acctsec, reconnected, forced the consent screen to include the sell.finances permission, verified the scope appeared in the granted-scopes list on the eBay Developer portal. All correct. Still 404. The real cause turned out to be that the Finances API lives on apiz.ebay.com — note the 'z' — not the standard api.ebay.com that the rest of the Sell APIs use. eBay split Finances onto a separate gateway. The code was hitting the wrong subdomain, so the gateway returned 'route not found' as an empty 404, which looked exactly like 'token doesn't have access.' One-character fix and the Payout tab populates with real numbers from the seller's account. Important lesson logged in memory: when an eBay endpoint returns empty 404, check whether it lives on apiz.ebay.com (Finances, and likely Logistics) before assuming OAuth."
        },
        @{
            Date  = "2026-06-12"
            Title = "Payout tab — order-level payouts now pro-rated across items"
            Body  = "With the Finances API working, fixed two more bugs in the payout sync: the transaction's order ID is a top-level field (not buried in a references array as the original code assumed), and the categorization rule for what counts as a fee was missing SHIPPING_LABEL transactions. New rule: any CREDIT to the seller increases the order payout, any DEBIT decreases it (also categorized as fee vs refund for reporting). For multi-item orders — one buyer bought two cards in the same order, total payout $150 — the payout is now pro-rated across items by each item's share of the gross sale. Two-item order with $89 + $84 sales gets split $77.10 / $72.90 so the Payout tab's per-item net profit reflects each card's actual share. Single-item orders unchanged."
        },
        @{
            Date  = "2026-06-12"
            Title = "Payout tab — text wrapping fix, Net Earnings rename, Sold column"
            Body  = "Three UI cleanups on the Payout tab. (1) Headers were wrapping mid-word — 'Postag' on one line, 'e' on the next; dollar values like $135.83 were splitting too. Added whitespace-nowrap via both Tailwind classes and inline style as a hard override, plus set the table min-width to 1000px so the narrow columns can't be squeezed. (2) Renamed 'Net to Mike' to 'Net Earnings' — Card Cloud's UI stays generic since it's built to scale beyond a single seller. (3) Added a 'Sold' date column (the order's creation date on eBay = when the buyer paid) to the Shipped tab, the Payout tab, and the Shipping page, with consistent 'Sold' header text across all three for visual consistency."
        },
        @{
            Date  = "2026-06-12"
            Title = "Shipping page — clickable tracking number links to carrier site"
            Body  = "The Shipping admin page showed tracking numbers as plain text. The eBay Listings -> Shipped tab already rendered them as clickable links to the carrier's public tracking page (USPS, UPS, FedEx, DHL — with 17track as fallback for unknown carriers). Now both pages use the same clickable-link behavior. Extracted the trackingUrl(carrier, tracking) helper to lib/tracking.ts as a shared module so future tabs that need it stay consistent."
        },
        @{
            Date  = "2026-06-12"
            Title = "eBay Sell Logistics API application submitted — for Standard Envelope shipping"
            Body  = "The seller's EasyPost account got locked out and password reset emails weren't arriving. Rather than fight EasyPost support indefinitely, pursued the better long-term path: eBay's own Sell Logistics API, which is the only way to buy eBay Standard Envelope shipping labels ($1.29 with tracking for cards under 3 oz — exclusive to eBay's API, not available through EasyPost, Shippo, or Pirate Ship). The seller activated the eBay Developer Support account, then submitted an Application Growth Check ticket (#260612-000021) requesting Sell Logistics API access. The application includes a full description of Card Cloud, the eBay Standard Envelope use case, the specific endpoints needed (shipping_quote and shipment), realistic call volume estimates, and confirmation that Card Cloud is already subscribed to eBay marketplace user account deletion notifications. eBay's typical turnaround is 1-2 weeks. A scheduled reminder will fire on Monday 2026-06-15 at 9 AM EDT with branching action plans for each possible status (Open / Approved / Rejected). When approved, integration plan: re-add sell.logistics to the OAuth scopes list, revoke + reconnect the eBay app, build lib/ebay-shipping.ts wrapping shipping_quote and shipment endpoints (with the apiz.ebay.com subdomain gotcha already noted — same as Finances), wire to the existing Shipping page Create Label button. In the meantime the seller continues to ship via eBay seller hub manually and the 'Mark as shipped + tracking' flow captures the tracking back into Card Cloud."
        }
    )

    foreach ($e in $entries) {
        $r.InsertParagraphAfter()
        $r.Collapse(0)
        $r.Style = $sn.Styles.Item("Heading 2")
        $r.InsertAfter("$($e.Date) — $($e.Title)")
        $r.Collapse(0)
        $r.InsertParagraphAfter()
        $r.Collapse(0)
        $r.Style = $sn.Styles.Item("Normal")
        $r.InsertAfter($e.Body)
        $r.Collapse(0)
    }

    $sn.Save()
    $sn.Close()
    Write-Host "SessionNotes updated with $($entries.Count) new entries."

    # ── Site Overview ────────────────────────────────────────────────
    $so = $word.Documents.Open($siteOverviewPath)
    $r2 = $so.Content
    $r2.Collapse(0)

    $r2.InsertParagraphAfter()
    $r2.Collapse(0)
    $r2.Style = $so.Styles.Item("Heading 1")
    $r2.InsertAfter("Recent Capability Updates (June 12, 2026)")
    $r2.Collapse(0)
    $r2.InsertParagraphAfter()
    $r2.Collapse(0)
    $r2.Style = $so.Styles.Item("Normal")

    $blocks = @(
        @{ H = "Multi-card lot listings end-to-end"
           B = "Card Cloud can now create eBay lot listings (cards bundled together) directly with one toggle. The form auto-fills the right category (Sports Trading Cards > Trading Card Lots), package dimensions (11x6x1 for a typical bubble mailer), and condition (Used) — and the AI description generator writes a lot-style description rather than the single-card prose it would produce otherwise. The optional 'Cards included in the lot' textarea lets sellers list specific cards which the AI then bullets in the description; left empty, the AI writes a generic lot description from photos and other details." }

        @{ H = "Scheduled listings actually wait now"
           B = "Toggling 'Schedule this listing' and picking a future date and time now actually schedules the listing on eBay — previously two compounding bugs (form defaults never committing + List on eBay not saving the draft first) meant scheduled listings published immediately. Fixed. Listings now arrive at their scheduled start time as expected." }

        @{ H = "Combined-order shipping — one label, multiple cards"
           B = "When a buyer purchases multiple cards in the same eBay order, Card Cloud now shows them as a single combined shipping row with one 'Create label' button. The system buys one shipping label sized for the combined package, marks all items shipped under the same tracking, and splits the postage cost across items so per-item net profit reporting stays accurate. Single-item orders are unchanged." }

        @{ H = "Auto-sync with eBay every 5 minutes"
           B = "Card Cloud now mirrors eBay's order, payment, fulfillment, and payout state automatically — every 5 minutes in the background, whether the admin is browsing or not. When a buyer pays, when an order ships, when eBay processes a payout, Card Cloud reflects it within minutes. A 'Refresh from eBay' button on the Shipping page lets the admin force an immediate sync when needed (e.g., right after manually shipping through eBay seller hub)." }

        @{ H = "Payout tab populated with real eBay payout data"
           B = "The Payout tab now shows real numbers: for every shipped sale, the eBay payout column displays what eBay actually paid the seller for that item (sale price minus eBay fees minus postage if bought through eBay), the Postage and Supplies columns track Card Cloud's own costs, and Net Earnings shows the seller's actual profit per card. For multi-item orders, the payout is pro-rated across items by their share of the order's gross sale. Underlying root cause that took most of the day to find: eBay's Finances API lives on apiz.ebay.com — note the 'z' — not the standard api.ebay.com that the other Sell APIs use." }

        @{ H = "Default shipping type setting + auto-fill on new listings"
           B = "Settings -> Rates -> Shipping now has a 'Default shipping type for new listings' dropdown (Flat / Calculated / Free). When set to Flat, every new internal listing comes up with the shipping cost type pre-filled to Flat Rate AND the price-buyer-pays auto-filled with the Bubble Mailer Min Cost value from the same section. One setting, no per-listing setup needed. Per-listing override is still available." }

        @{ H = "Mark as shipped with manual tracking entry"
           B = "When shipping outside Card Cloud (eBay seller hub directly, Pirate Ship, etc.), the 'Mark as shipped' button now prompts for the tracking number and carrier. Card Cloud saves both so the Shipped tab shows the tracking as a clickable link to the carrier's tracking page just like Card Cloud-bought shipments — even when Card Cloud didn't buy the label." }

        @{ H = "Tracking numbers are clickable everywhere"
           B = "Shipping page tracking numbers now link directly to the carrier's tracking page (USPS, UPS, FedEx, DHL recognized; falls back to 17track.net for unknown carriers). Matches the behavior that already existed on the eBay Listings -> Shipped tab. Click the tracking number to see real-time delivery status." }
    )

    foreach ($b in $blocks) {
        $r2.Style = $so.Styles.Item("Heading 2")
        $r2.InsertAfter($b.H)
        $r2.Collapse(0)
        $r2.InsertParagraphAfter()
        $r2.Collapse(0)
        $r2.Style = $so.Styles.Item("Normal")
        $r2.InsertAfter($b.B)
        $r2.Collapse(0)
        $r2.InsertParagraphAfter()
        $r2.Collapse(0)
    }

    $so.Save()
    $so.Close()
    Write-Host "SiteOverview updated with $($blocks.Count) capability blocks."
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
Write-Host "Done."
