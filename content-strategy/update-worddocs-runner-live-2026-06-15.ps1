$ErrorActionPreference = "Stop"

$sessionNotesPath = "C:\Users\mikea\OneDrive\Desktop\CardCloud_SessionNotes.docx"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    $sn = $word.Documents.Open($sessionNotesPath)
    $r = $sn.Content
    $r.Collapse(0)

    $entry = @{
        Date  = "2026-06-15"
        Title = "Local agent runner live — end-to-end Run Now wired up"
        Body  = "The AI Lab Agents page already had Run Now and Schedule buttons, and the Facebook Group Discovery script was wired into the agent list, but clicking Run only set a run_pending flag in site_settings — nothing was actually reading it. Closed the loop today. A small Node.js daemon at scripts/agent-runner/ now runs as a PM2-managed process on the operator's local Windows machine. Once per minute it GETs an authenticated /api/ai-lab/agents/poll on production, picks up any agents with run_pending set or a fired cron schedule, dispatches them as child processes, tails stdout and stderr into a log buffer, then POSTs the final status to /api/ai-lab/agents/result so the UI can show last-run info. The dispatcher understands four script-field conventions: npm:<name>, <path>.ts, <path>.ps1, and <path>.py — covering every agent script we currently have. Agent options become CLI flags automatically. Authentication is a shared bearer token stored in site_credentials.agent_runner_token on Railway and mirrored in the runner's gitignored .env file. PM2 wiring needed a tiny shim (scripts/agent-runner/start.js) because PM2 can't directly exec npx and Node 24+ on Windows refuses to spawn .cmd shims without a shell. Verified end-to-end: after Railway deployed commit 8e06247 the runner restarted and went silent (correct — empty due queue), and a manual curl with the token returned 200 plus an empty due list. The next time the operator clicks Run Now on any agent card in the admin UI, the runner will pick it up within a minute and execute. The first real test will be the Facebook Group Discovery agent, which runs a headed Playwright browser using the operator's saved FB session to find large active card-collecting groups by keyword."
    }

    $r.InsertParagraphAfter()
    $r.Collapse(0)
    $r.Style = $sn.Styles.Item("Heading 2")
    $r.InsertAfter("$($entry.Date) — $($entry.Title)")
    $r.Collapse(0)
    $r.InsertParagraphAfter()
    $r.Collapse(0)
    $r.Style = $sn.Styles.Item("Normal")
    $r.InsertAfter($entry.Body)
    $r.Collapse(0)

    $sn.Save()
    $sn.Close()
    Write-Host "SessionNotes updated with the runner-live entry."
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
Write-Host "Done."
