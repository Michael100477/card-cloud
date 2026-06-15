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
            Date  = "2026-06-15"
            Title = "AI Lab documentation pass plus Facebook Group Discovery agent groundwork"
            Body  = "The AI Lab is The Card Cloud's internal control center for AI-driven features. After several months of additions it now has seven distinct sub-areas under /admin/ai-lab/ (Models, Testing, Photo Fix, Photo Training, Email, Messages, Agents) plus a Training Data backing store, but no unified description existed in any single place. Pulled all of it together into the Site Overview as a single section so the operator and any future collaborator can see the whole landscape on one page. Also added a new agent to the Agents roster: Facebook Group Discovery, which uses a headed Playwright browser plus the operator's saved Facebook session to search by keyword for large active card-collecting groups and append results to the Communities workbook for review. This is the first agent that has to run LOCAL to the operator's Windows machine (Railway can't execute Playwright with a personal FB session), which forces an architecture decision about how cloud-hosted admin Run Now and Schedule buttons dispatch local work. Solution: pull-based — admin UI sets a pending flag in site_settings, a local agent runner daemon polls Card Cloud every minute via authenticated API, picks up pending work, spawns the script, posts results back. Backend endpoints for Run Now and Schedule were built today; the local runner daemon itself is the next deliverable. The discovery agent is also already usable as a standalone script outside the AI Lab UI: one-shot manual (npm run discover:facebook), one-shot full discovery-plus-workbook-append (npm run discover:facebook:full), or weekly headed run via Windows Task Scheduler (default 6 PM Sunday — chosen to match the operator's normal FB usage hours so the activity pattern doesn't look anomalous to FB's risk detection)."
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
    Write-Host "SessionNotes updated."

    # ── Site Overview ────────────────────────────────────────────────
    $so = $word.Documents.Open($siteOverviewPath)
    $r2 = $so.Content
    $r2.Collapse(0)

    # Top-level heading for AI Lab
    $r2.InsertParagraphAfter()
    $r2.Collapse(0)
    $r2.Style = $so.Styles.Item("Heading 1")
    $r2.InsertAfter("The AI Lab")
    $r2.Collapse(0)
    $r2.InsertParagraphAfter()
    $r2.Collapse(0)
    $r2.Style = $so.Styles.Item("Normal")

    $intro = "The AI Lab is The Card Cloud's internal control center for AI-driven features. Everything that uses an LLM, a vision model, or an autonomous agent lives here. The lab is organized into seven sub-areas plus a Training Data backing store, all reachable from the AI Lab overview page at /admin/ai-lab/."
    $r2.InsertAfter($intro)
    $r2.Collapse(0)
    $r2.InsertParagraphAfter()
    $r2.Collapse(0)

    $sections = @(
        @{ H = "Models"
           B = "Local Ollama model management. Lists every Ollama model installed on the operator's machine, which are currently loaded, and the VRAM each occupies. New models can be pulled (e.g., llama3.2-vision:11b for raw card recognition), loaded into memory, and unloaded from the UI without dropping to a shell. These vision models power the raw card recognition and photo-fix workflows." }

        @{ H = "Testing"
           B = "Sandbox for trying prompts against any installed model. Used to tune system prompts and few-shot examples before wiring a workflow into production. Side-by-side mode lets the operator compare outputs from two models on the same input." }

        @{ H = "Photo Fix (Card Photo Straightener)"
           B = "Upload a phone photo of a card. AI detects the card's edges, corrects rotation, and crops with a clean border. Used for two purposes: cleaning up seller-uploaded inventory photos before they go on a listing, and preparing photos to feed into the training data pipeline." }

        @{ H = "Photo Training"
           B = "Gallery of training examples with category, face, diagnosis, descriptor properties, and reference templates for description.txt. The data here trains the Raw Card Recognition Agent — over time the model learns to identify cards from any angle, lighting, or background based on examples the operator has reviewed and labeled." }

        @{ H = "Email"
           B = "Email agent dashboard. Watches an IMAP support inbox and auto-replies using Claude Haiku with a card-collecting policy system prompt. Incoming email is categorized (questions, complaints, consignment inquiries, etc.) and either responded to automatically or flagged for human attention. Frida Day (The Card Cloud's customer support persona) signs the outgoing replies." }

        @{ H = "Messages"
           B = "Unified inbox showing eBay buyer messages and support email side-by-side under one Messages page. A background monitor pings every five minutes; when a buyer message arrives that needs action, the operator gets a priority-sorted email summary so they can respond on eBay directly. No auto-replies on eBay (eBay policy). The support-email side does auto-reply via the Email agent." }

        @{ H = "Agents"
           B = "Configurable automated scripts with Run Now and cron Schedule controls. Each agent has its own card showing what it does, options to tweak (e.g., 'PSA grader', 'card count', 'Ollama model'), a Run button that streams logs, and a schedule editor with cron presets. The current roster is: eBay Training Data Collector (downloads slab photos and metadata from eBay search results), TCDB Set Scraper (downloads card images and metadata from tcdb.com for a specific set), New Set Monitor (scans Cardboard Connection and Beckett News for newly announced sets), TCDB Availability Checker (daily sweep that marks queued sets ready to scrape once 70% of cards have images), Email Inbox Poller (IMAP poll trigger for the support inbox), Raw Card Recognition Agent (Ollama vision model identifies ungraded cards from photos), and Facebook Group Discovery (Playwright browser searches Facebook for large active card-collecting groups by keyword and appends results to the Communities workbook). Agents that need to run on the operator's local machine (Playwright, Ollama, IMAP) are dispatched via a local agent runner — a small Node.js daemon that polls Card Cloud every minute for pending work and posts results back." }

        @{ H = "Training Data table"
           B = "Database table that backs the AI training pipeline. Each example has a source (eBay, TCDB, scan, etc.), a verified flag (human-reviewed), and rich metadata. The AI Lab overview page surfaces counts by source plus pending-review count. Verified examples flow into model fine-tuning runs." }
    )

    foreach ($s in $sections) {
        $r2.Style = $so.Styles.Item("Heading 2")
        $r2.InsertAfter($s.H)
        $r2.Collapse(0)
        $r2.InsertParagraphAfter()
        $r2.Collapse(0)
        $r2.Style = $so.Styles.Item("Normal")
        $r2.InsertAfter($s.B)
        $r2.Collapse(0)
        $r2.InsertParagraphAfter()
        $r2.Collapse(0)
    }

    $so.Save()
    $so.Close()
    Write-Host "SiteOverview updated with The AI Lab section ($($sections.Count) sub-sections)."
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
Write-Host "Done."
