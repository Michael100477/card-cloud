$ErrorActionPreference = "Stop"

$communitiesPath = "C:\Users\mikea\OneDrive\Desktop\CardCloud_Communities_Template.xlsx"
if (-not (Test-Path $communitiesPath)) {
    throw "Communities workbook not found at: $communitiesPath"
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $wb = $excel.Workbooks.Open($communitiesPath)
    $reddit = $wb.Worksheets.Item("Reddit")

    # Full list of subs grouped by category. All Monitor role for now since
    # we won't be posting via Reddit early on. URLs are the standard
    # reddit.com/r/{name} format.
    $subs = @(
        # ── Main hobby ───────────────────────────────────────────────────
        @("r/sportscards",            "reddit.com/r/sportscards",            "Monitor", "Main hobby sub, ~600K members - highest-volume signal"),
        @("r/SportsCardCollector",    "reddit.com/r/SportsCardCollector",    "Monitor", "Secondary hub, different audience tilt"),
        @("r/baseballcards",          "reddit.com/r/baseballcards",          "Monitor", "Large sport-specific, vintage + modern mix"),
        @("r/footballcards",          "reddit.com/r/footballcards",          "Monitor", "Active sport-specific community"),
        @("r/basketballcards",        "reddit.com/r/basketballcards",        "Monitor", "High modern volume"),
        @("r/hockeycards",            "reddit.com/r/hockeycards",            "Monitor", "Smaller but real, often ignored elsewhere"),
        @("r/soccercards",            "reddit.com/r/soccercards",            "Monitor", "Growing fast as European market expands"),
        @("r/wrestlingcards",         "reddit.com/r/wrestlingcards",         "Monitor", "AEW + WWE collector base, niche but devoted"),

        # ── TCG and non-sport ────────────────────────────────────────────
        @("r/PokemonTCG",             "reddit.com/r/PokemonTCG",             "Monitor", "Huge TCG community, drama + market data"),
        @("r/pkmntcgcollections",     "reddit.com/r/pkmntcgcollections",     "Monitor", "Pokemon collection-focused"),
        @("r/MagicTCG",               "reddit.com/r/MagicTCG",               "Monitor", "Magic players + collectors, reserved list signal"),
        @("r/yugioh",                 "reddit.com/r/yugioh",                 "Monitor", "Yu-Gi-Oh community"),
        @("r/Lorcana",                "reddit.com/r/Lorcana",                "Monitor", "New game, fast-growing collector base"),

        # ── Vintage / pre-war ────────────────────────────────────────────
        @("r/vintage_cards",          "reddit.com/r/vintage_cards",          "Monitor", "Pre-1980 focus"),
        @("r/PrewarCards",            "reddit.com/r/PrewarCards",            "Monitor", "Pre-1948 / tobacco cards, small but high-quality"),

        # ── Grading ──────────────────────────────────────────────────────
        @("r/PSA",                    "reddit.com/r/PSA",                    "Monitor", "PSA-specific drama, turnaround, pop reports"),
        @("r/cardgrading",            "reddit.com/r/cardgrading",            "Monitor", "Multi-grader coverage (BGS, SGC, CGC)"),

        # ── Manufacturer brands ──────────────────────────────────────────
        @("r/Topps",                  "reddit.com/r/Topps",                  "Monitor", "Topps drops, drama, supply issues"),
        @("r/Topps_Chrome",           "reddit.com/r/Topps_Chrome",           "Monitor", "Brand-specific (Chrome/Refractor signal)"),
        @("r/Panini",                 "reddit.com/r/Panini",                 "Monitor", "Panini drops; NBA license transition fallout"),
        @("r/Bowman",                 "reddit.com/r/Bowman",                 "Monitor", "Topps subsidiary, prospect-heavy collectors"),
        @("r/Bowman_Chrome",          "reddit.com/r/Bowman_Chrome",          "Monitor", "Brand-cult sub for Chrome refractors"),
        @("r/UpperDeck",              "reddit.com/r/UpperDeck",              "Monitor", "Hockey + entertainment cards; activity may be low"),
        @("r/LeafTradingCards",       "reddit.com/r/LeafTradingCards",       "Monitor", "Leaf (Brian Gray) modern releases; activity may be low"),
        @("r/WildCardTradingCards",   "reddit.com/r/WildCardTradingCards",   "Monitor", "Small manufacturer; sub may be near-dormant - probe and drop if empty"),
        @("r/Fanatics",               "reddit.com/r/Fanatics",               "Monitor", "Parent company; overlaps with sports memorabilia"),

        # ── Market data / community-branded ──────────────────────────────
        @("r/sportscardinvestor",     "reddit.com/r/sportscardinvestor",     "Monitor", "Geoff Wilson's branded community, market-data leaning"),

        # ── Showcase + adjacent ──────────────────────────────────────────
        @("r/cardphotos",             "reddit.com/r/cardphotos",             "Monitor", "Where people show off collections - direct signal for showcase angle"),
        @("r/sportscollectibles",     "reddit.com/r/sportscollectibles",     "Monitor", "Broader collectibles (autos, jerseys) - adjacent audience"),

        # ── Estate / inheritance ─────────────────────────────────────────
        @("r/whatsthisworth",         "reddit.com/r/whatsthisworth",         "Monitor", "General 'I inherited this' sub - direct fit for estate content"),

        # ── Marketplace signal ───────────────────────────────────────────
        @("r/COMC",                   "reddit.com/r/COMC",                   "Monitor", "Check My Cards community"),
        @("r/eBay",                   "reddit.com/r/eBay",                   "Monitor", "Seller community - filter for card-specific posts"),
        @("r/grailcards",             "reddit.com/r/grailcards",             "Monitor", "Big-money chase pieces"),

        # ── Niche sports ─────────────────────────────────────────────────
        @("r/golfcards",              "reddit.com/r/golfcards",              "Monitor", "Niche but real"),
        @("r/UFCCards",               "reddit.com/r/UFCCards",               "Monitor", "UFC card collectors"),
        @("r/cricket_cards",          "reddit.com/r/cricket_cards",          "Monitor", "Cricket cards (UK / Aus / India)"),

        # ── Regional ─────────────────────────────────────────────────────
        @("r/AusCards",               "reddit.com/r/AusCards",               "Monitor", "Australian collectors"),
        @("r/UKsportscards",          "reddit.com/r/UKsportscards",          "Monitor", "UK collectors")
    )

    # Write starting at row 5 (overwriting the gray-italic example row)
    $row = 5
    foreach ($s in $subs) {
        for ($i = 0; $i -lt $s.Count; $i++) {
            $c = $reddit.Cells.Item($row, $i + 1)
            $c.Value2 = $s[$i]
            $c.Font.Italic = $false
            $c.Font.Color   = 0      # black
        }
        $row++
    }

    # Re-fit columns since we widened the notes considerably
    $reddit.Columns.AutoFit() | Out-Null
    # Cap widths so notes don't blow up
    for ($i = 1; $i -le 4; $i++) {
        $col = $reddit.Columns.Item($i)
        if ($col.ColumnWidth -gt 80) { $col.ColumnWidth = 80 }
    }

    $wb.Save()
    $wb.Close()
    Write-Host "Reddit tab updated with $($subs.Count) subreddits."
}
finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
Write-Host "Done."
