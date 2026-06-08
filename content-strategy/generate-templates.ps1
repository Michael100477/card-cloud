$ErrorActionPreference = "Stop"

$outDir          = "C:\Users\mikea\OneDrive\Desktop"
$voiceBriefPath  = Join-Path $outDir "CardCloud_VoiceBrief_Template.docx"
$communitiesPath = Join-Path $outDir "CardCloud_Communities_Template.xlsx"

if (Test-Path $voiceBriefPath)  { Remove-Item $voiceBriefPath  -Force }
if (Test-Path $communitiesPath) { Remove-Item $communitiesPath -Force }

# ─────────────────────────────────────────────────────────────────
# VOICE BRIEF (.docx via Word COM)
# ─────────────────────────────────────────────────────────────────
Write-Host "Building voice brief..."

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Add()
    $sel = $word.Selection

    function Write-Heading([string]$text, [string]$style = "Heading 1") {
        $sel.Style = $doc.Styles.Item($style)
        $sel.TypeText($text)
        $sel.TypeParagraph()
    }

    function Write-Body([string]$text) {
        $sel.Style = $doc.Styles.Item("Normal")
        $sel.Font.Italic = $false
        $sel.Font.Color = 0
        $sel.TypeText($text)
        $sel.TypeParagraph()
    }

    function Write-Hint([string]$text) {
        $sel.Style = $doc.Styles.Item("Normal")
        $sel.Font.Italic = $true
        $sel.Font.Color = 8421504  # gray
        $sel.TypeText($text)
        $sel.TypeParagraph()
        $sel.Font.Italic = $false
        $sel.Font.Color = 0
    }

    # Title
    Write-Heading "TheCardCloud Voice Brief" "Title"

    Write-Body "This document defines how TheCardCloud sounds across articles, emails, and social posts. The content agent reads this every time it drafts something — your answers become standing instructions for the brand voice."
    Write-Body "Write in your own words. Plain bullets and rough phrasing are fine — Mike's judgment is the goal, not polished prose."
    $sel.TypeParagraph()

    # Numbered prose sections
    $sections = @(
        @{ N=1; T="Who we are (1-2 sentences)";
           H="Example: TheCardCloud is a consignment platform run by an actual collector. We help collectors track, value, sell, and consign cards without the games and markup of bigger sites." }
        @{ N=2; T="Who we're talking to";
           H="Be specific. 'Collectors' is too broad. Are they newer or experienced? Investors or hobbyists? What do they wish someone would tell them straight?" }
        @{ N=3; T="Five words that describe how we sound";
           H="Examples: plain-spoken, skeptical, grounded, useful, dryly funny." }
        @{ N=4; T="Five things we never sound like";
           H="Examples: hype-y, influencer-y, jargon-heavy, salesy, vague, preachy." }
        @{ N=5; T="Our take on the hobby (point of view)";
           H="What do we believe? What do we push back on? What do other hobby outlets get wrong? This is the 'why people read us instead of Cardlines' answer." }
        @{ N=6; T="Topics we cover";
           H="Card releases, market moves, manufacturer news, grading, consignment guides, breaking, eBay flips, etc." }
        @{ N=7; T="Topics we don't cover";
           H="Anything off-limits — political takes, off-topic player drama, speculative pump-and-dump content, financial advice framing, etc." }
    )

    foreach ($s in $sections) {
        Write-Heading "$($s.N). $($s.T)" "Heading 2"
        Write-Hint $s.H
        Write-Body "[Your answer]"
        $sel.TypeParagraph()
    }

    # Section 8 — table
    Write-Heading "8. Phrases we'd say vs. wouldn't" "Heading 2"
    Write-Hint "Fill in 3-5 rows each. Even rough examples help the agent calibrate. This is the highest-leverage section — if you only nail one, nail this one."

    $sel.EndKey(6) | Out-Null  # wdStory
    $table = $doc.Tables.Add($sel.Range, 7, 2)
    $table.Borders.Enable = $true
    $table.Cell(1,1).Range.Text = "We'd say"
    $table.Cell(1,2).Range.Text = "We wouldn't say"
    $table.Cell(1,1).Range.Font.Bold = $true
    $table.Cell(1,2).Range.Font.Bold = $true
    $table.Cell(1,1).Shading.BackgroundPatternColor = 15986394  # light blue
    $table.Cell(1,2).Shading.BackgroundPatternColor = 15986394
    $table.Cell(2,1).Range.Text = "sold-through rate jumped 20% week-over-week"
    $table.Cell(2,2).Range.Text = "absolutely fire these are MOVING (with rocket emojis)"
    $table.Cell(2,1).Range.Font.Italic = $true
    $table.Cell(2,2).Range.Font.Italic = $true
    $table.Cell(2,1).Range.Font.Color = 8421504
    $table.Cell(2,2).Range.Font.Color = 8421504

    $sel.EndKey(6) | Out-Null
    $sel.TypeParagraph()
    $sel.TypeParagraph()

    # Section 9
    Write-Heading "9. Format preferences" "Heading 2"
    $sel.Style = $doc.Styles.Item("List Bullet")
    $bullets = @(
        "Typical article length (e.g., 600-1,000 words):",
        "Headers / subheads (yes / no / sparingly):",
        "Bulleted lists (yes / no / sparingly):",
        "Emojis (yes / no / sparingly — and any specific ones you like or hate):",
        "Voice perspective (first-person 'I think...' / brand 'TheCardCloud...' / neutral):",
        "Email sign-off style (e.g., '-- Mike, TheCardCloud' / 'Thanks, Mike' / no signature):"
    )
    foreach ($b in $bullets) {
        $sel.TypeText($b)
        $sel.TypeParagraph()
    }
    $sel.Style = $doc.Styles.Item("Normal")
    $sel.TypeParagraph()

    # Section 10
    Write-Heading "10. Two sample lines you'd be proud to publish (optional)" "Heading 2"
    Write-Hint "One sentence each. If nothing comes to mind right now, skip — we can build this from your reactions to drafts later."
    Write-Body "1."
    Write-Body "2."

    # Save
    $wdFormatDocumentDefault = 16
    $doc.SaveAs2($voiceBriefPath, $wdFormatDocumentDefault)
    $doc.Close()
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

Write-Host "Voice brief saved: $voiceBriefPath"

# ─────────────────────────────────────────────────────────────────
# COMMUNITIES (.xlsx via Excel COM)
# ─────────────────────────────────────────────────────────────────
Write-Host "Building communities workbook..."

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $wb = $excel.Workbooks.Add()
    while ($wb.Worksheets.Count -gt 1) {
        $wb.Worksheets.Item($wb.Worksheets.Count).Delete()
    }
    $firstSheet = $wb.Worksheets.Item(1)

    function Build-Sheet {
        param(
            $Sheet,
            [string]$Title,
            [string]$Instructions,
            [string[]]$Headers,
            [object[]]$ExampleRow,
            [int]$BlankRows = 12
        )

        # Title
        $Sheet.Cells.Item(1,1).Value2 = $Title
        $Sheet.Cells.Item(1,1).Font.Bold = $true
        $Sheet.Cells.Item(1,1).Font.Size = 14
        if ($Headers.Count -gt 1) {
            $r = $Sheet.Range($Sheet.Cells.Item(1,1), $Sheet.Cells.Item(1, $Headers.Count))
            $r.Merge() | Out-Null
        }

        # Instructions
        $Sheet.Cells.Item(2,1).Value2 = $Instructions
        $Sheet.Cells.Item(2,1).Font.Italic = $true
        $Sheet.Cells.Item(2,1).Font.Color = 6710886
        if ($Headers.Count -gt 1) {
            $r = $Sheet.Range($Sheet.Cells.Item(2,1), $Sheet.Cells.Item(2, $Headers.Count))
            $r.Merge() | Out-Null
        }
        $Sheet.Rows.Item(2).RowHeight = 32
        $Sheet.Cells.Item(2,1).WrapText = $true

        # Headers (row 4)
        for ($i = 0; $i -lt $Headers.Count; $i++) {
            $c = $Sheet.Cells.Item(4, $i+1)
            $c.Value2 = $Headers[$i]
            $c.Font.Bold = $true
            $c.Interior.Color = 15986394
        }

        # Example row (5)
        if ($ExampleRow -ne $null) {
            for ($i = 0; $i -lt $ExampleRow.Count; $i++) {
                $c = $Sheet.Cells.Item(5, $i+1)
                $c.Value2 = $ExampleRow[$i]
                $c.Font.Italic = $true
                $c.Font.Color = 8421504
            }
        }

        # Freeze top 4 rows
        $Sheet.Activate()
        $excel.ActiveWindow.SplitRow = 4
        $excel.ActiveWindow.FreezePanes = $true

        # Column widths
        $Sheet.Columns.AutoFit() | Out-Null
        for ($i = 1; $i -le $Headers.Count; $i++) {
            $col = $Sheet.Columns.Item($i)
            if ($col.ColumnWidth -lt 22) { $col.ColumnWidth = 22 }
            if ($col.ColumnWidth -gt 55) { $col.ColumnWidth = 55 }
        }
    }

    $missing = [System.Reflection.Missing]::Value
    function New-Sheet($name) {
        $last = $wb.Worksheets.Item($wb.Worksheets.Count)
        $s = $wb.Worksheets.Add($missing, $last, $missing, $missing)
        $s.Name = $name
        return $s
    }

    # ── Sheet 1: Overview / instructions ──
    $firstSheet.Name = "Start Here"
    $firstSheet.Cells.Item(1,1).Value2 = "TheCardCloud Communities & Sources"
    $firstSheet.Cells.Item(1,1).Font.Bold = $true
    $firstSheet.Cells.Item(1,1).Font.Size = 16

    $intro = @(
        "Fill in the tabs below with the specific groups, channels, accounts, hashtags, and feeds we should monitor for trends and (where applicable) post into.",
        "",
        "Doesn't need to be perfect on the first pass. Even a handful of entries per platform gives us enough to start Phase 1.",
        "",
        "Each tab has one example row in gray italic — that's just a model of what to fill in, you can overwrite it or delete it.",
        "",
        "Role column legend:",
        "  Monitor — pull trend signal from here",
        "  Post — publish content here",
        "  Both — both",
        "",
        "Don't fill in URLs unless you have them handy — name + handle is enough; we can look up URLs later."
    )
    for ($i = 0; $i -lt $intro.Count; $i++) {
        $firstSheet.Cells.Item($i+3, 1).Value2 = $intro[$i]
    }
    $firstSheet.Columns.Item(1).ColumnWidth = 110

    # ── Facebook ──
    $s = New-Sheet "Facebook"
    Build-Sheet -Sheet $s `
        -Title "Facebook" `
        -Instructions "Groups you're in or want to join, plus public pages worth monitoring. For private groups, note whether they allow business pages (some don't). Personal account does the monitoring; TheCardCloud Page does the posting." `
        -Headers @("Group / Page Name", "URL", "Public / Private", "Allows business pages?", "Role", "Notes") `
        -ExampleRow @("Vintage Sports Card Talk", "facebook.com/groups/vintagecardtalk", "Private", "Unknown", "Monitor", "Big vintage group, very active in evenings")

    # ── Reddit ──
    $s = New-Sheet "Reddit"
    Build-Sheet -Sheet $s `
        -Title "Reddit" `
        -Instructions "Subreddits worth watching. We monitor via the free Reddit API — no login needed." `
        -Headers @("Subreddit", "URL", "Role", "Notes") `
        -ExampleRow @("r/sportscards", "reddit.com/r/sportscards", "Monitor", "Main hobby sub")

    # ── Twitter / X ──
    $s = New-Sheet "Twitter-X"
    Build-Sheet -Sheet $s `
        -Title "Twitter / X" `
        -Instructions "Accounts (brands, dealers, key voices) and hashtags. Use the Type column to distinguish. Note in 'Role' whether TheCardCloud should post here." `
        -Headers @("Type (Account / Hashtag)", "Handle or Tag", "URL", "Role", "Notes") `
        -ExampleRow @("Account", "@cardladder", "x.com/cardladder", "Monitor", "Pricing data tweets")

    # ── Instagram ──
    $s = New-Sheet "Instagram"
    Build-Sheet -Sheet $s `
        -Title "Instagram" `
        -Instructions "Creator accounts to monitor and hashtags to track. Posting happens from TheCardCloud's business account (must be linked to the FB Page)." `
        -Headers @("Type (Account / Hashtag)", "Handle or Tag", "URL", "Role", "Notes") `
        -ExampleRow @("Hashtag", "#thehobby", "instagram.com/explore/tags/thehobby", "Monitor", "General hobby tag, high volume")

    # ── TikTok ──
    $s = New-Sheet "TikTok"
    Build-Sheet -Sheet $s `
        -Title "TikTok" `
        -Instructions "Creators worth monitoring + hashtags. Video content is parsed via captions/comments/engagement; we transcribe individual videos only if they're going viral." `
        -Headers @("Type (Account / Hashtag)", "Handle or Tag", "URL", "Role", "Notes") `
        -ExampleRow @("Account", "@bigtimecardz", "tiktok.com/@bigtimecardz", "Monitor", "Daily card-of-the-day videos")

    # ── YouTube ──
    $s = New-Sheet "YouTube"
    Build-Sheet -Sheet $s `
        -Title "YouTube" `
        -Instructions "Channels worth monitoring for new uploads + community signal. Free YouTube API; we pull titles, descriptions, and upload timestamps." `
        -Headers @("Channel Name", "URL", "Role", "Notes") `
        -ExampleRow @("Geoff Wilson / Sports Card Investor", "youtube.com/@SportsCardInvestor", "Monitor", "Weekly market roundups")

    # ── Discord ──
    $s = New-Sheet "Discord"
    Build-Sheet -Sheet $s `
        -Title "Discord" `
        -Instructions "Servers you're already in (worth monitoring) plus plans for TheCardCloud's own server. Note: see the 'TheCardCloud Properties' tab for our own Discord setup details." `
        -Headers @("Server Name", "Invite or URL", "Role", "Notes") `
        -ExampleRow @("Card Collectors Hub", "discord.gg/example", "Monitor", "Active general hobby Discord")

    # ── Newsletters ──
    $s = New-Sheet "Newsletters"
    Build-Sheet -Sheet $s `
        -Title "Newsletters" `
        -Instructions "Email newsletters you subscribe to that should feed the daily digest. You'll forward these to a dedicated inbox we set up — we parse them automatically. List the sender email if you remember it." `
        -Headers @("Newsletter Name", "Sender Email", "Frequency", "Notes") `
        -ExampleRow @("Cardlines", "newsletter@cardlines.com", "Daily", "Industry news + market takes")

    # ── Manufacturer pages ──
    $s = New-Sheet "Manufacturers"
    Build-Sheet -Sheet $s `
        -Title "Manufacturer / Press Pages" `
        -Instructions "Topps, Panini, Fanatics, Upper Deck, Bowman, etc. — pages where they announce new products. URL helps; if you only know the brand name, that's fine." `
        -Headers @("Brand", "URL", "RSS / Email / Scrape?", "Notes") `
        -ExampleRow @("Topps", "topps.com/news", "Scrape", "Posts product releases here")

    # ── Other sources ──
    $s = New-Sheet "Other Sources"
    Build-Sheet -Sheet $s `
        -Title "Other / Off the Beaten Path" `
        -Instructions "Forums (Blowout Cards), Substacks, blogs, podcasts, price-data sites, anything hobby-relevant that doesn't fit the other tabs." `
        -Headers @("Source Name", "URL", "Type", "Notes") `
        -ExampleRow @("Blowout Cards Forums", "forums.blowoutcards.com", "Forum", "Lots of breaker chatter")

    # ── TheCardCloud Properties ──
    $s = New-Sheet "TheCardCloud Properties"
    Build-Sheet -Sheet $s `
        -Title "TheCardCloud's Own Accounts & Communities" `
        -Instructions "Where TheCardCloud already exists or plans to exist. Status: Not created / Exists / Planned. Target launch can be a rough month or condition (e.g., 'after 50 email signups')." `
        -Headers @("Platform", "Handle / Name", "Status", "Target Launch", "Notes") `
        -ExampleRow @("Discord (our own)", "TheCardCloud Lounge", "Planned", "Month 2 of content", "Channels: general, values, consignment-help, recent-pulls")

    # Pre-fill our own properties tab with the platforms we'd want presence on
    $ourPlatforms = @(
        @("Discord (our own)",       "",                    "Planned",     "",                                ""),
        @("Facebook (our own group)","",                    "Planned",     "",                                "Separate from posting to existing groups"),
        @("Facebook Page",           "facebook.com/...",    "?",           "Now",                             "For posting articles + updates"),
        @("Instagram (business)",    "@thecardcloud",       "?",           "Now",                             "Must be linked to FB Page"),
        @("TikTok (business)",       "@thecardcloud",       "?",           "Now",                             ""),
        @("Twitter / X",             "@thecardcloud",       "?",           "Now",                             ""),
        @("YouTube",                 "",                    "Not created", "Later",                           ""),
        @("LinkedIn (company page)", "",                    "?",           "Now",                             "Lower priority but easy")
    )
    $row = 6
    foreach ($p in $ourPlatforms) {
        for ($i = 0; $i -lt $p.Count; $i++) {
            $s.Cells.Item($row, $i+1).Value2 = $p[$i]
        }
        $row++
    }

    # Move first sheet to front, activate it
    $firstSheet.Move($wb.Worksheets.Item(1)) 2>$null
    $firstSheet.Activate()

    $xlOpenXMLWorkbook = 51
    $wb.SaveAs($communitiesPath, $xlOpenXMLWorkbook)
    $wb.Close($false)
}
finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

Write-Host "Communities workbook saved: $communitiesPath"
Write-Host "Done."
