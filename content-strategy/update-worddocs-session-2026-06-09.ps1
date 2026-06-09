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
            Date  = "2026-06-09"
            Title = "EasyPost shipping label integration — buy USPS labels from Card Cloud"
            Body  = "Card Cloud can now buy USPS shipping labels directly through the website instead of relying on eBay's Logistics API (which turned out to be a Limited Release product requiring separate approval from eBay's Developer Program). The new flow uses EasyPost — Auctane's modern shipping API. Same USPS Commercial Plus rates Mike was getting through Stamps.com, $0.01 per label, pay-as-you-go. The Create Label button on the existing Shipping page works for eBay orders; a new ""Create new label"" button next to it opens a standalone form for any other shipment (sending gifts, returns, miscellaneous packages — no eBay order required). After EasyPost generates the label, Card Cloud still POSTs the tracking number to eBay's Fulfillment API so the buyer gets a tracking notification, so the buyer experience is identical to if the label had been bought through eBay."
        },
        @{
            Date  = "2026-06-09"
            Title = "Standalone label form — see prices before buying"
            Body  = "The new label form is three-phase. First you fill in the recipient address and package dimensions and click Get rates. EasyPost creates a shipment behind the scenes and returns every available USPS service with its price and estimated delivery days, sorted cheapest first. You pick one with a radio button and click Buy label — the button shows the exact price (e.g., 'Buy label · $4.13'). After purchase, a success screen shows tracking number, carrier, service, cost, and a Print label button that opens the label in a new tab pre-positioned for printing. The shipment is only charged when you click Buy — Get rates is free."
        },
        @{
            Date  = "2026-06-09"
            Title = "Test/production toggle for EasyPost"
            Body  = "EasyPost has a free sandbox (test mode) that generates fake labels for verifying the integration without spending money. Admin → API Keys → Shipping — EasyPost has a Test API Key field, a Production API Key field, and an Environment slider that flips between them with one click — no Edit/Save/Cancel cycle. test on the left (gray), production on the right (red with a ""⚠ real money"" warning). Switching is instant. The first label Mike ran through the integration was a test mode fake; once that worked he flipped to production for real shipments."
        },
        @{
            Date  = "2026-06-09"
            Title = "Print page tuned for label paper bottom-half sticky portion"
            Body  = "Mike's label paper has the sticky 4x6 area on the bottom half of an 8.5x11 sheet, with the non-sticky portion above it. When his printer feeds the paper, the sticky portion enters first. The print page (a clean route at /print/label, outside the admin sidebar) takes the 4x6 PNG label from EasyPost, rotates it 90 degrees to landscape orientation, and places it on the page so that what appears at the top of the print preview lands on the sticky bottom of the physical paper. Position is tuned to give equal 0.75-inch margins on either side of the rotated 4-inch label inside the 5.5-inch sticker area Mike measured. Verified end-to-end — test label printed correctly on the sticky portion, centered, no extra blank pages."
        },
        @{
            Date  = "2026-06-09"
            Title = "eBay token-refresh crash loop fixed"
            Body  = "Earlier in the day, the background eBay monitors (message monitor, feedback monitor) were crashing in a loop with 'invalid_scope' every time they tried to refresh the access token. Cause: lib/ebay-auth.ts was passing the current SCOPES list when refreshing, but the refresh_token was issued with a different scope set than today's code requests, so eBay rejected each refresh. Standard OAuth fix — don't pass scope on refresh, eBay reuses whatever was granted at the original handshake. Shipped to Railway as commit 4643296."
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
    $r2.InsertAfter("Recent Capability Updates (June 9, 2026)")
    $r2.Collapse(0)
    $r2.InsertParagraphAfter()
    $r2.Collapse(0)
    $r2.Style = $so.Styles.Item("Normal")

    $blocks = @(
        @{ H = "Native shipping label purchase via EasyPost"
           B = "Card Cloud can now buy USPS shipping labels directly from the website. The Shipping admin page has two flows: Create Label on a paid eBay order automatically pulls the buyer's name, address, and order details and buys the label tied to that order. A separate Create New Label button opens a standalone form for any other shipment — sending gifts, returns, anything not on eBay. Same USPS Commercial Plus rates as Stamps.com or Pirate Ship, $0.01 per label on top of postage." }

        @{ H = "Get rates before buying"
           B = "The standalone label form shows every available USPS service with its price and estimated delivery before any money is spent. Mike picks the service he wants with a radio button and clicks Buy — the button shows the exact dollar amount that will be charged. The pricing query is free; only the actual label purchase costs money." }

        @{ H = "Print page laid out for label paper bottom-half stickers"
           B = "After buying a label, the Print Label button opens a separate tab that lays the 4x6 USPS label sideways (landscape) on the bottom-half sticky portion of standard 8.5x11 shipping label paper. Dialed in so the label sits centered with 0.75-inch margins on either side of the sticker, with the print orientation set to match Mike's printer's paper-feed direction (sticky-side leading). One sheet of paper per label, no overflow, auto-opens the print dialog when ready." }

        @{ H = "Buyer still notified through eBay regardless of where label was bought"
           B = "After Card Cloud buys a label through EasyPost, it POSTs the tracking number to eBay's Fulfillment API. eBay then emails the buyer with the tracking info, updates the eBay order page, and starts polling the carrier for delivery status — exactly as if the label had been bought through eBay's seller hub. The buyer can't tell the difference between an EasyPost label and an eBay-purchased label." }
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
