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

    # Append additional channels — global soccer + hockey content,
    # added after the operator (correctly) pushed back on the US-centric
    # framing that excluded these categories.
    $additions = @(
        # ── Soccer / Football (global, NOT just UK) ──────────────────────
        @("Dutch Soccer Card Collector",   "youtube.com/@DutchSoccerCardCollector", "Monitor", "~17K subs, established collector channel (verify handle)"),
        @("Football Collectibles (Toby)",  "youtube.com/@FootballCollectibles",     "Monitor", "Long-time soccer card + sticker collector, IG + YT presence"),
        @("Pablo Football Cards",          "youtube.com/@PabloFootballCards",       "Monitor", "Soccer-focused collector content"),
        @("Football Cards Portugal",       "youtube.com/@FootballCardsPortugal",    "Monitor", "Portuguese soccer card community (verify handle)"),
        @("Football Cards HUN",            "youtube.com/@FootballCardsHUN",         "Monitor", "Hungarian soccer card content (verify handle)"),

        # ── Hockey ───────────────────────────────────────────────────────
        @("Puck Junk (Sal Barry)",         "youtube.com/@PuckJunk",                 "Monitor", "Hockey card podcast + Upper Deck breaks (verify handle)"),
        @("In the Box",                    "youtube.com/@InTheBox",                 "Monitor", "Hockey-focused mail days, 400K+ card collector (verify handle - generic name)")
    )

    # Find the next empty row by scanning column A
    $row = 5
    while ($yt.Cells.Item($row, 1).Value2) { $row++ }
    Write-Host "Appending at row $row"

    foreach ($c in $additions) {
        for ($i = 0; $i -lt $c.Count; $i++) {
            $cell = $yt.Cells.Item($row, $i + 1)
            $cell.Value2     = $c[$i]
            $cell.Font.Italic = $false
            $cell.Font.Color  = 0
        }
        $row++
    }

    $yt.Columns.AutoFit() | Out-Null
    for ($i = 1; $i -le 4; $i++) {
        $col = $yt.Columns.Item($i)
        if ($col.ColumnWidth -gt 80) { $col.ColumnWidth = 80 }
    }

    $wb.Save()
    $wb.Close()
    Write-Host "Appended $($additions.Count) channels to YouTube tab."
}
finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
Write-Host "Done."
