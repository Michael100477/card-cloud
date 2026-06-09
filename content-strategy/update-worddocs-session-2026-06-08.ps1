$ErrorActionPreference = "Stop"

$sessionNotesPath = "C:\Users\mikea\OneDrive\Desktop\CardCloud_SessionNotes.docx"
$siteOverviewPath = "C:\Users\mikea\OneDrive\Desktop\CardCloud_SiteOverview.docx"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    # ── Session Notes — append today's entries ─────────────────────────────
    $sn = $word.Documents.Open($sessionNotesPath)
    $r = $sn.Content
    $r.Collapse(0)

    $entries = @(
        @{
            Date  = "2026-06-08"
            Title = "Mirror eBay state in admin listings — auto-import + buyer fetch"
            Body  = "The admin eBay Listings page now mirrors eBay 1:1 regardless of whether a listing came in through Card Cloud or was created directly on eBay. The order sync was extended to auto-create internal_listing rows for any eBay order whose item it has never seen, and a new SoldList importer fills in items that ended on eBay but have not yet generated a Fulfillment-API order (auctions that ended overnight with no committed buyer yet). A separate GetItemTransactions call now fetches the actual buyer username + name for those sold-but-not-paid rows so the Waiting for Payment tab shows real buyers (visgt/Jeremy Vanover, collector21-22/RAYMOND VALLES, briansmustanggt/Brian Shestko, etc) instead of 'not yet synced'. The fragile auto-demote gate that required at least one active auction to be in eBay's response was replaced with a 'fresh successful snapshot' check, so a quiet week no longer strands rows in 'active'. The savedInternalListings filter that was hiding rows when updatedAt happened to equal createdAt was rewritten to look at real lifecycle fields. End-to-end verified: counts went from 11 items to 55, matching eBay's view exactly."
        },
        @{
            Date  = "2026-06-08"
            Title = "UI consistency pass on listings tabs + shipping page"
            Body  = "Manual rows used to render with a bold player name + light year/set header above the title; auto-imported rows just showed the title. Unified every Card cell across Consignment, Waiting for Payment, Waiting to be Shipped, Shipped, Ended, plus the Shipping admin page to use a single 'title + eBay # + View link' format. The View link now always renders even when no stored URL exists (it constructs https://www.ebay.com/itm/<id> on the fly). Buyer column on Waiting for Payment falls back to buyer username when the full name from shipping address is not yet available. Sold column was wrongly using listedAt; switched to soldAt populated from eBay's EndTime. Direct-listings endpoint that powers the 'Listed Directly on eBay' section had the same broken updatedAt filter and was de-duplicating wrong; fixed."
        },
        @{
            Date  = "2026-06-08"
            Title = "Waiting to be Shipped — group items by buyer"
            Body  = "When the same buyer has won multiple cards, the Waiting to be Shipped tab now collapses them into a single row with all items stacked in the Card cell, the buyer shown once, sale prices summed with an itemized breakdown, the latest paidAt timestamp, and a single Create label button. A small amber '📦 N items — ship together' badge calls out the grouping. Jeremy Vanover's two paid items (Bo Jackson Sweet Spot + Leaf Limited) now render as one row with a $235.83 total instead of two separate Create-label rows."
        },
        @{
            Date  = "2026-06-08"
            Title = "Shipping label flow — Logistics API requires special approval, switching to EasyPost"
            Body  = "Create Label was returning a 404 from eBay's Logistics API. Diagnosis: the OAuth scope list was missing the sell.logistics scope (and the sell.fulfillment write scope needed by the post-label 'mark order shipped' call). Added both scopes; reconnect on Railway returned invalid_scope. The sell.logistics scope is a Limited Release product — eBay only grants it through a separate Developer Program approval that takes 1–2 weeks. Pulled sell.logistics back out so reconnect works again. Kept sell.fulfillment (standard scope). Strategic decision: use EasyPost instead of eBay's Logistics API. EasyPost is REST-based, $0.01 per label, has the same USPS Commercial Plus rates as Stamps.com, and decouples label purchase from eBay reporting. The existing 'POST to /sell/fulfillment/v1/order/{id}/shipping_fulfillment' call (which Card Cloud already does after buying a label) is what gets the tracking number into eBay so the buyer is notified — that part stays the same regardless of where the label is purchased. EasyPost integration build is queued for the next session, awaiting Mike's EasyPost API keys."
        },
        @{
            Date  = "2026-06-08"
            Title = "Topology change — local code now shares Railway's production database"
            Body  = "Mike asked for local to automatically mirror Railway's eBay data without running any sync scripts. Migrated all 55 items + tokens + credentials from local Docker Postgres to Railway Postgres (483 rows total via a one-time copy). Then switched local's DATABASE_URL in .env to point directly at Railway. Local code now reads and writes Railway's database. The Docker Postgres container is still on the machine as a rescue fallback but is not what the running app talks to. Both the localhost:3001 PM2 instance and the Railway-hosted Card Cloud see identical data because they are literally the same database. Trade-offs: page loads on local are slightly slower due to cross-region DB queries; any destructive action taken locally hits production. eBay OAuth was simplified — both environments use Railway's RuName, the browser briefly visits Railway during the callback, tokens land in the shared DB, then either UI can use them. A second RuName Mike registered for localhost (and the corresponding code branch) was abandoned because eBay requires HTTPS for the registered callback URL and localhost is HTTP-only."
        },
        @{
            Date  = "2026-06-08"
            Title = "New rule — verify documentation before every response, not just every session"
            Body  = "After the changelog and Word docs fell several days behind, Mike escalated the documentation cadence: before completing any response, self-check whether the changelog or these Word docs should be updated based on what just happened. The earlier 'every session with code changes' rule allowed drift; the new rule is 'every response, every time.' Triggers include any code change, any memory file change, any architectural decision, any generated artifact (templates, configs, scripts), and any user-facing capability change. Only pure conversation with no decisions and no artifacts is exempt."
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

    # ── Site Overview — append updates section ──────────────────────────────
    $so = $word.Documents.Open($siteOverviewPath)
    $r2 = $so.Content
    $r2.Collapse(0)

    $r2.InsertParagraphAfter()
    $r2.Collapse(0)
    $r2.Style = $so.Styles.Item("Heading 1")
    $r2.InsertAfter("Recent Capability Updates (June 8, 2026)")
    $r2.Collapse(0)
    $r2.InsertParagraphAfter()
    $r2.Collapse(0)
    $r2.Style = $so.Styles.Item("Normal")

    $blocks = @(
        @{ H = "Local and production now share the same database"
           B = "The development environment running on Mike's machine no longer has its own database. Both localhost:3001 and the live Railway-hosted Card Cloud talk to the exact same Railway-managed Postgres. This means the local site automatically mirrors production eBay data without any sync scripts or manual refresh — any consignment, listing, sale, or shipped order shows up in both UIs identically. The Docker Postgres container that used to back local dev is still on Mike's machine as an emergency offline fallback but is otherwise dormant." }

        @{ H = "Admin eBay Listings page mirrors eBay 1:1"
           B = "Card Cloud no longer cares whether a listing was created through the Card Cloud flow or directly on eBay. The Admin Listings page imports every eBay order Mike has, fetches buyer information for every sold-but-not-paid auction (via eBay's GetItemTransactions API), and renders everything in a uniform 'title + eBay link' format. Tabs (Consignment, Internal, Scheduled, Waiting for Payment, Waiting to be Shipped, Shipped, Ended) all reflect eBay's actual state. Counts move automatically as buyers commit, pay, and shipments are confirmed." }

        @{ H = "Waiting to be Shipped groups multi-item orders"
           B = "When a single buyer has won multiple cards, the Waiting to be Shipped tab now collapses them into a single shipping row with one Create-label button. The total sale price, all eBay item links, and a 'ship together' badge make it clear that the buyer is getting one package. Reduces clicks and prevents accidentally creating multiple shipments for one buyer." }

        @{ H = "Shipping label flow — moving from eBay's Logistics API to EasyPost"
           B = "Card Cloud's Create-label button was originally wired to eBay's Sell Logistics API, which turns out to be a Limited Release product requiring special approval from eBay's Developer Program. We're switching to EasyPost — same USPS Commercial Plus rates, $0.01 per label, REST API. The label purchase moves to EasyPost; the existing eBay 'mark order shipped' call (which notifies the buyer with a tracking number) stays the same. End user experience is identical. Integration build is the next development session." }

        @{ H = "Shipping page Card cells unified with the rest of the admin"
           B = "Same titles-only render format the Listings tabs use is now on the Shipping admin page. The 'View on eBay' link works on every row including auto-imported ones." }
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
