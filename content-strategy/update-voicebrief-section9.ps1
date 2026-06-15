$ErrorActionPreference = "Stop"

$voiceBriefPath = "C:\Users\mikea\OneDrive\Desktop\CardCloud_VoiceBrief_Template.docx"

if (-not (Test-Path $voiceBriefPath)) {
    throw "Voice brief not found at: $voiceBriefPath"
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $doc = $word.Documents.Open($voiceBriefPath)

    # Each line in Section 9 has a unique prompt prefix. Find by that prefix,
    # jump to end of the line, and append the answer. Safe even if Mike already
    # has fill-ins on other sections — these prefixes only appear in Section 9.
    $answers = @(
        @{ prefix = "Typical article length";  answer = " 2-5 minute read (roughly 500-1,200 words depending on density)" },
        @{ prefix = "Headers / subheads";      answer = " Sparingly - 2-4 H2 headers in a typical article" },
        @{ prefix = "Bulleted lists";          answer = " Yes, where they earn their place; mix prose and bullets" },
        @{ prefix = "Emojis";                  answer = " Almost never in articles; never the hype family (rocket, fire, gem, siren)" },
        @{ prefix = "Voice perspective";       answer = " First-person plural ('we') as the default" },
        @{ prefix = "Email sign-off";          answer = " No signature" }
    )

    $selection = $word.Selection

    foreach ($a in $answers) {
        # Reset to start of document so each Find starts fresh
        $selection.HomeKey(6) | Out-Null  # wdStory

        $find = $selection.Find
        $find.ClearFormatting()
        $find.Text     = $a.prefix
        $find.Forward  = $true
        $find.Wrap     = 0  # wdFindStop

        if ($find.Execute()) {
            $selection.EndKey(5) | Out-Null  # wdLine - move to end of the line
            $selection.TypeText($a.answer)
            Write-Host "Updated: $($a.prefix)"
        } else {
            Write-Warning "Could not find prefix: $($a.prefix)"
        }
    }

    $doc.Save()
    $doc.Close()
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

Write-Host "Done."
