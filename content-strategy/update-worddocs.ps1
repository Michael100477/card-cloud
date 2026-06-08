$ErrorActionPreference = "Stop"

$sessionNotesPath = "C:\Users\mikea\OneDrive\Desktop\CardCloud_SessionNotes.docx"
$siteOverviewPath = "C:\Users\mikea\OneDrive\Desktop\CardCloud_SiteOverview.docx"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    # ─────────── Session Notes — append new entries ───────────
    $sn = $word.Documents.Open($sessionNotesPath)
    $r = $sn.Content
    $r.Collapse(0)  # collapse to end

    $entries = @(
        @{
            Date  = "2026-05-31"
            Title = "Local dev DB migrated from PGlite to Docker Postgres"
            Body  = "The local development database moved off Prisma's PGlite (which kept idling out mid-session and breaking dev) onto a Docker Postgres 16 container named card-cloud-postgres on port 5433. A migration script copied 434 rows across 36 tables — cards, collections, internal listings, ebay listings, site credentials, page layouts, everything. The card-cloud-db pm2 process was removed from the ecosystem since the Docker container is now the source of truth. The same connection string format (DATABASE_URL) keeps working; only the host/port changed."
        },
        @{
            Date  = "2026-06-04"
            Title = "Recovered local DB after the Docker volume was wiped"
            Body  = "Mike opened the dashboard and saw 'no collections or cards' despite having added them. The Docker volume holding the local database had been recreated earlier in the day (both container and volume show the same creation timestamp), wiping every row that had been migrated on May 31. Recovery was possible because the original PGlite data directory was still on disk at C:\Users\mikea\AppData\Local\prisma-dev-nodejs\Data\default\.pglite — last written 12 minutes before the Docker recreation. Booted PGlite back up, ran a rescue script that truncated all destination tables in one bulk statement (per-table TRUNCATE CASCADE in a loop kept wiping already-inserted rows in earlier attempts), then re-inserted all 434 rows. Final verified counts: users=1, cards=4, collections=1, card_collections=4, internal_listings=11, accounts=1, site_credentials=57."
        },
        @{
            Date  = "2026-06-04"
            Title = "New rule — every destructive change needs a rollback first"
            Body  = "After the volume-loss scare, Mike added a permanent rule: before any database migration, schema reset, container or volume recreation, force-push, or other hard-to-reverse action, capture a rollback path first (for the local DB that's pg_dump to card-cloud\db-backups\) and call out the rollback path in chat alongside the action — not after. A baseline pg_dump and a recurring daily dump job are on the follow-up list so the next volume loss is recoverable without luck. No code or schema changed for this rule, but it changes how every future destructive action is staged."
        },
        @{
            Date  = "2026-06-05"
            Title = "Codified the dev / production split (local vs Railway)"
            Body  = "Made the two-environment topology explicit so the two databases stop getting conflated when reasoning about state. The local site at C:\Users\mikea\card-cloud running on port 3001 plus the Docker Postgres on :5433 is development — every change is built and tested here. Railway plus Railway Postgres is production, and a push to origin/main IS a production deploy because Railway auto-deploys on push. No more automatic pushes to main — the workflow now is commit locally, verify locally, ask Mike to try it, then push only after he OKs (or explicitly says 'push it'). Every status update from here will distinguish 'changed locally' from 'deployed to Railway' so it's never ambiguous which environment was touched."
        },
        @{
            Date  = "2026-06-07"
            Title = "Phase 0 of the content engine — voice brief and communities templates"
            Body  = "After a long critical discussion on how to drive traffic without becoming an AI content farm, the content engine was scoped into six phases. Phase 0 is Mike-input only: a voice brief that defines how TheCardCloud sounds in articles, emails, and social posts, plus a communities inventory listing the specific groups, accounts, hashtags, channels, and newsletters we should monitor (input) and post to (output). Both templates were generated as Office files saved to OneDrive\Desktop: CardCloud_VoiceBrief_Template.docx (10 numbered sections, table for 'we'd say vs wouldn't say', bullets for format preferences) and CardCloud_Communities_Template.xlsx (one tab per platform plus a TheCardCloud Properties tab pre-seeded with the accounts and communities we plan to launch — own Discord, own FB group, FB Page, IG business, TikTok business, Twitter/X, LinkedIn, YouTube). The generation script and a content-strategy folder were added to the project at C:\Users\mikea\card-cloud\content-strategy\. No code in the app changed yet; the phased plan is captured in the conversation log and will start landing in code once the brief and communities list are filled in. The strategy is positioned for 5,000 paying users at $5/month as a realistic one-person-company target — articles are fuel for email and social, not pure SEO."
        },
        @{
            Date  = "2026-06-07"
            Title = "Doc-update rule escalated — verify before every response"
            Body  = "Mike caught that the changelog and Word docs were behind. New cadence: before completing ANY response, self-check whether the changelog or these Word docs should be updated based on what just happened. The earlier 'every session' rule allowed drift; the new rule is 'every response, every time.' Memory file feedback_changelog.md was updated with the explicit self-check trigger list — code changes, memory file changes, architectural or strategic decisions, generation of project artifacts (templates, configs, scripts) — all require an update before the response is considered complete. Only pure conversation with no decisions and no artifacts is exempt."
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

    # ─────────── Site Overview — append a 'Recent Capability Updates' section ───────────
    $so = $word.Documents.Open($siteOverviewPath)
    $r2 = $so.Content
    $r2.Collapse(0)

    $r2.InsertParagraphAfter()
    $r2.Collapse(0)
    $r2.Style = $so.Styles.Item("Heading 1")
    $r2.InsertAfter("Recent Capability Updates (through June 2026)")
    $r2.Collapse(0)
    $r2.InsertParagraphAfter()
    $r2.Collapse(0)
    $r2.Style = $so.Styles.Item("Normal")

    $blocks = @(
        @{ H = "Development environment vs production"
           B = "The site now runs in two clearly separate environments. Development is on Mike's machine at C:\Users\mikea\card-cloud, served by pm2 on port 3001, with a Docker Postgres database on port 5433. This is where every feature is built and tested. Production is hosted on Railway with a separate Railway-managed Postgres database. A push to the main branch on GitHub automatically deploys to Railway — the two databases never touch each other, and code only reaches production after the change has been verified locally and approved." }

        @{ H = "Photos now go to Cloudflare R2 (production)"
           B = "The photo upload route now writes to Cloudflare R2, an S3-compatible object store. In development it can still fall back to local disk if no R2 credentials are set, but the production target is R2. Switching providers later is one credential change, not a code change." }

        @{ H = "Admin eBay listings page — comprehensive tab system"
           B = "The admin eBay listings page now organizes everything into seven tabs: Consignment (active consigned auctions), Internal (cards The Card Cloud owns directly), Scheduled (drafts queued to go live), Waiting for Payment (ended auctions with a winning bidder who hasn't paid), Waiting to be Shipped (paid auctions awaiting fulfillment), Shipped (tracking numbers visible), and Ended (auctions that ran but didn't sell). A global search box across the top searches every tab at once, including listings posted directly on eBay outside The Card Cloud flow. Auctions auto-move between tabs based on live eBay status — sold goes to Waiting for Payment if the winner hasn't paid yet, then Shipped once tracking is attached." }

        @{ H = "Auto-detection of multi-card lots in the scan flow"
           B = "When Mike scans a slab or raw card to draft a new listing, the vision step now detects when the image shows multiple cards. If so, the listing draft auto-switches the eBay category to Trading Card Lots so the listing gets created correctly the first time without manual category fixes." }

        @{ H = "Admin sidebar — collapsible and viewport-aware"
           B = "The admin shell now has a collapsible navigation sidebar with a persistent collapsed/expanded preference per browser. When the browser window narrows below a tablet width the sidebar auto-collapses to an icon rail; Mike's manual choice always wins over the automatic behavior. The footer of the sidebar has both 'Exit admin' (back to the user dashboard) and 'Sign out' as explicit actions, so admin sessions are never trapped." }

        @{ H = "Dashboard — log out and switch between admin and user views"
           B = "The user dashboard's profile menu now shows a 'Sign out' option (powered by NextAuth) and, for admin accounts, a 'Switch to admin console' shortcut. Non-admin users never see the switcher. This makes it easy to test the platform as a regular user while logged in with an admin account." }

        @{ H = "Buyer messaging from the admin"
           B = "Sold-listing rows now make the buyer username clickable, which opens a modal for sending an eBay message to that buyer. The subject auto-fills with the listing title (instead of a generic 'About your purchase' placeholder) and the message is sent via eBay's AddMemberMessageAAQToPartner endpoint." }

        @{ H = "Phased content engine plan (planned)"
           B = "A multi-phase content engine has been scoped to drive traffic via articles, email, and social — without becoming an AI content farm. Phase 0 (in progress) is Mike filling in a voice brief and a communities inventory. Phase 1 builds a daily intelligence digest from Reddit, Twitter/X, YouTube, RSS feeds, and forwarded newsletters. Phase 2 adds Playwright-driven monitoring of Facebook, Instagram, and TikTok via saved page HTML (no scraping). Phase 3 is a drafting assistant that turns a digest item into an article, email blurb, and social posts in TheCardCloud's voice — Mike reviews and publishes. Phase 4 wires direct platform APIs (Meta Graph, Twitter, TikTok Business, LinkedIn, Threads, Bluesky) plus an ESP for the weekly digest email — no Buffer middleman. Phase 5 layers in consignment-data content once the platform has real volume. Phase 6 is TheCardCloud's own Discord and Facebook group, both planned. Target audience: 5,000 paying users at $5/month." }
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
