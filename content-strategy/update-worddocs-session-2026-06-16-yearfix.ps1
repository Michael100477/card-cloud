$ErrorActionPreference = "Stop"

$sessionNotesPath = "C:\Users\mikea\OneDrive\Desktop\CardCloud_SessionNotes.docx"
$siteOverviewPath = "C:\Users\mikea\OneDrive\Desktop\CardCloud_SiteOverview.docx"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    # -- Session Notes ------------------------------------------------
    $sn = $word.Documents.Open($sessionNotesPath)
    $r = $sn.Content
    $r.Collapse(0)

    $entries = @(
        @{
            Date  = "2026-06-16"
            Title = "Fix: multi-year season (1986-87) was being dropped from generated listings"
            Body  = "When the operator corrected an AI-identified card year from '1986' to '1986-87' (the standard basketball/hockey season format, since those seasons cross two calendar years) and clicked Generate, the generated title still read '1986'. Root cause: the Year field on the internal-listing editor is free text, but the payload sent to the listing-generation API ran it through parseInt(), and parseInt('1986-87') returns 1986 — so the AI never saw the '-87'. Fix touched two files. InternalListingEditor.tsx buildCardData() now sends the year exactly as typed (raw string) instead of parseInt'ing it; this function only feeds generation, so the numeric year column used on save is unaffected. The generation API route widened its year type to accept a string and gained a title rule telling the model to preserve a two-year span like '1986-87' rather than shortening it to '1986'. Net result: the generated title and description, plus the eBay Season field, now carry '1986-87' (matching eBay's basketball/hockey conventions), while the internal numeric year column still stores 1986. Verified the editor page compiles and serves with no 500 on the running dev server."
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
    Write-Host "SessionNotes updated with $($entries.Count) new entry."

    # -- Site Overview ------------------------------------------------
    $so = $word.Documents.Open($siteOverviewPath)
    $r2 = $so.Content
    $r2.Collapse(0)

    $r2.InsertParagraphAfter()
    $r2.Collapse(0)
    $r2.Style = $so.Styles.Item("Heading 1")
    $r2.InsertAfter("Recent Fixes (June 16, 2026)")
    $r2.Collapse(0)
    $r2.InsertParagraphAfter()
    $r2.Collapse(0)
    $r2.Style = $so.Styles.Item("Normal")

    $blocks = @(
        @{ H = "Two-year card seasons (e.g. 1986-87) are honored in listings"
           B = "Basketball and hockey sets are labeled with a two-year season (1986-87) because the season spans two calendar years. When the seller types a season like '1986-87' into the Year field and generates a listing, the generated title and description now keep '1986-87' instead of collapsing it to '1986'. The eBay Season field carries the full span too." }
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
    Write-Host "SiteOverview updated with $($blocks.Count) block."
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
Write-Host "Done."
