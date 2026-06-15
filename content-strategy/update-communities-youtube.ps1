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
    $yt = $wb.Worksheets.Item("YouTube")

    # Channel Name | URL (best-guess handle, agent verifies) | Role | Notes
    # All Monitor role for now. URLs use the @handle convention; uncertain
    # handles flagged in Notes so the digest agent knows to verify.
    $channels = @(
        # ── Sports cards (operator-curated) ──────────────────────────────
        @("King of the Kards",                       "youtube.com/@KingoftheKards",         "Monitor", "Hobby collector content"),
        @("SKY-B Cards",                             "youtube.com/@SKY-BCards",             "Monitor", "Hobby coverage (verify handle)"),
        @("MOJO Sports",                             "youtube.com/@MOJOSports",             "Monitor", "Hobby + break coverage"),
        @("The Collector Files",                     "youtube.com/@TheCollectorFiles",      "Monitor", "Collector-focused coverage"),
        @("Market Movers by Sports Card Investor",   "youtube.com/@MarketMoversSCI",        "Monitor", "Geoff Wilson team - market data focus (verify handle)"),
        @("Sports Card Investor",                    "youtube.com/@SportsCardInvestor",     "Monitor", "Geoff Wilson - anchor channel, market analysis + interviews"),
        @("Rothcards",                               "youtube.com/@Rothcards",              "Monitor", "Hobby content"),
        @("IF Sports Cards",                         "youtube.com/@IFSportsCards",          "Monitor", "Hobby coverage (verify handle)"),
        @("CardCollector2",                          "youtube.com/@CardCollector2",         "Monitor", "Market news + hobby commentary"),
        @("TRIKE Sports Cards",                      "youtube.com/@TRIKESportsCards",       "Monitor", "Hobby content (verify handle)"),
        @("Packman",                                 "youtube.com/@Packman",                "Monitor", "Break / hobby content (verify handle - generic name)"),
        @("CHASING CARDBOARD",                       "youtube.com/@CHASINGCARDBOARD",       "Monitor", "Hobby coverage"),
        @("Stryker Breaks",                          "youtube.com/@StrykerBreaks",          "Monitor", "Breaker - for hot-pull signal only"),

        # ── Pokemon TCG (operator-curated) ───────────────────────────────
        @("Sleeve No Card Behind",                   "youtube.com/@SleeveNoCardBehind",     "Monitor", "Pokemon TCG focus"),
        @("Leonhart",                                "youtube.com/@Leonhart",               "Monitor", "Pokemon TCG, well-known creator"),
        @("TraderJons",                              "youtube.com/@TraderJons",             "Monitor", "TCG market commentary"),
        @("JunkSeeker",                              "youtube.com/@JunkSeeker",             "Monitor", "TCG hunting + collecting"),
        @("Ptcgradio",                               "youtube.com/@Ptcgradio",              "Monitor", "Pokemon TCG podcast / news"),
        @("Deep Pocket Monster",                     "youtube.com/@DeepPocketMonster",      "Monitor", "Pokemon TCG collector-focused"),
        @("RealBreakingNate",                        "youtube.com/@RealBreakingNate",       "Monitor", "Pokemon TCG breaks + news"),

        # ── Magic (added) ────────────────────────────────────────────────
        @("Tolarian Community College",              "youtube.com/@tolariancommunitycollege", "Monitor", "The Professor - biggest Magic channel, vintage + reserved list signal"),
        @("Alpha Investments",                       "youtube.com/@AlphaInvestments",       "Monitor", "Rudy - controversial Magic finance figure, moves markets"),

        # ── Vintage sports (added) ───────────────────────────────────────
        @("Vintage Lou",                             "youtube.com/@VintageLou",             "Monitor", "Vintage sports card retrospectives - matches 'stories beat grades' voice"),

        # ── Industry / news (added) ──────────────────────────────────────
        @("Beckett Media",                           "youtube.com/@beckettmedia",           "Monitor", "Industry news, price-guide-adjacent editorial")
    )

    # Write starting at row 5 (overwriting the gray-italic example row)
    $row = 5
    foreach ($c in $channels) {
        for ($i = 0; $i -lt $c.Count; $i++) {
            $cell = $yt.Cells.Item($row, $i + 1)
            $cell.Value2     = $c[$i]
            $cell.Font.Italic = $false
            $cell.Font.Color  = 0  # black
        }
        $row++
    }

    # Re-fit columns since notes are long
    $yt.Columns.AutoFit() | Out-Null
    for ($i = 1; $i -le 4; $i++) {
        $col = $yt.Columns.Item($i)
        if ($col.ColumnWidth -gt 80) { $col.ColumnWidth = 80 }
    }

    $wb.Save()
    $wb.Close()
    Write-Host "YouTube tab updated with $($channels.Count) channels."
}
finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
Write-Host "Done."
