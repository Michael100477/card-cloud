// Facebook group discovery agent.
//
// Reads a list of search keywords from keywords.json, runs each as a FB
// group search using the saved session, scrolls to load results, extracts
// group name + URL + member count + activity tag, dedupes, scores, filters,
// and writes the results to a per-day CSV in scripts/social-discovery/results/.
//
// Append the CSV to the Communities workbook with the companion
// append-to-workbook.ps1 script (run automatically by the npm script).
//
// Usage:
//   npx tsx scripts/social-discovery/discover-facebook.ts            # headed (visible browser)
//   npx tsx scripts/social-discovery/discover-facebook.ts --headless # background
//   npx tsx scripts/social-discovery/discover-facebook.ts --debug    # save screenshots per search

import { chromium, type Page } from "playwright";
import * as path from "node:path";
import * as fs from "node:fs";

const HERE        = __dirname;
const SESSION_PATH = path.join(HERE, ".fb-session.json");
const KEYWORDS_PATH = path.join(HERE, "keywords.json");
const RESULTS_DIR = path.join(HERE, "results");

interface KeywordsConfig {
  keywords: string[];
  thresholds: { min_members: number; very_active_bonus: number };
  scroll_passes: number;
  throttle_ms: [number, number];
}

interface GroupRow {
  name:           string;
  url:            string;
  members:        number;          // best parse from "12K members" / "1.5M members"
  members_raw:    string;          // original text for sanity check
  activity:       string;          // "Very active" | "Active" | ""
  privacy:        string;          // "Public" | "Private" | ""
  description:    string;
  score:          number;
  source_keyword: string;
}

const argv      = process.argv.slice(2);
const isHeaded  = !argv.includes("--headless");
const isDebug   = argv.includes("--debug");

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function throttle([lo, hi]: [number, number]): number {
  return Math.floor(lo + Math.random() * (hi - lo));
}

function parseMemberCount(text: string): number {
  // Examples FB shows: "1.5K members", "12K members", "1.2M members", "250 members"
  const m = text.match(/([\d.,]+)\s*([KMkm]?)\s*member/);
  if (!m) return 0;
  const n   = parseFloat(m[1].replace(/,/g, ""));
  const suf = (m[2] || "").toUpperCase();
  if (suf === "K") return Math.round(n * 1_000);
  if (suf === "M") return Math.round(n * 1_000_000);
  return Math.round(n);
}

async function extractGroupsFromPage(page: Page, keyword: string): Promise<GroupRow[]> {
  // FB's group search results live in feed-like containers. The DOM changes
  // frequently; we use a few resilient strategies:
  //   1. find all anchor links to /groups/{id}/
  //   2. for each, walk up to the nearest visible card and pull text
  //   3. parse member count + activity tag from the card text
  // If FB changes things and this comes back empty, run with --debug and
  // inspect the screenshot to update selectors.
  const groups: GroupRow[] = await page.evaluate(({ keyword }) => {
    const seen = new Set<string>();
    const out: Array<{ name: string; url: string; members_raw: string; activity: string; privacy: string; description: string; source_keyword: string }> = [];

    const groupLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(
      'a[href*="/groups/"][role="link"]'
    ));

    for (const a of groupLinks) {
      const href = a.href;
      const match = href.match(/\/groups\/([^/?#]+)/);
      if (!match) continue;

      // Filter out non-group hrefs (notifications, feed paths, etc.)
      const groupId = match[1];
      if (/^(feed|joins|discover|create|search|notifications|new|category)$/i.test(groupId)) continue;

      const cleanUrl = `https://www.facebook.com/groups/${groupId}/`;
      if (seen.has(cleanUrl)) continue;

      // Walk up to find the parent card. Cards on FB are typically
      // div[role="article"] or a similar container with multiple lines.
      let card: HTMLElement | null = a.closest('[role="article"]') as HTMLElement
                                  ?? a.closest('[data-pagelet*="Result"]') as HTMLElement
                                  ?? a.closest('div[class]:has(span)') as HTMLElement;
      // Fallback: walk up 5 levels
      if (!card) {
        let p: HTMLElement | null = a.parentElement;
        for (let i = 0; i < 5 && p; i++) { card = p; p = p.parentElement; }
      }
      if (!card) continue;

      const text = (card.innerText || "").trim();
      if (!text) continue;

      // Group name is usually the link text (cleaned) OR first line of the card
      const name = (a.innerText || "").trim() || text.split("\n")[0]?.trim() || "(unknown)";

      // Look for member count
      const memberMatch = text.match(/[\d.,KMkm]+\s*member/);
      const members_raw = memberMatch ? memberMatch[0] : "";

      // Activity badge
      let activity = "";
      if (/very active/i.test(text)) activity = "Very active";
      else if (/\bactive\b/i.test(text)) activity = "Active";

      // Privacy
      let privacy = "";
      if (/\bPublic\b/.test(text)) privacy = "Public";
      else if (/\bPrivate\b/.test(text)) privacy = "Private";

      // Description — try to grab a chunk that isn't the name/members/privacy
      const lines = text.split("\n").map(l => l.trim()).filter(l =>
        l.length > 20 && !l.includes(name) && !memberMatch?.[0]?.includes(l) && l !== "Public" && l !== "Private"
      );
      const description = lines[0]?.slice(0, 180) || "";

      out.push({ name, url: cleanUrl, members_raw, activity, privacy, description, source_keyword: keyword });
      seen.add(cleanUrl);
    }

    return out;
  }, { keyword });

  // Compute parsed member count in node (parseMemberCount needs Node regex)
  return groups.map(g => ({
    ...g,
    members: parseMemberCount(g.members_raw),
    score:   0,
  }));
}

function scoreGroup(g: GroupRow, cfg: KeywordsConfig): number {
  return g.members + (g.activity === "Very active" ? cfg.thresholds.very_active_bonus : 0);
}

function writeCSV(filePath: string, rows: GroupRow[]) {
  const cols: Array<keyof GroupRow> = ["score", "name", "members", "activity", "privacy", "url", "description", "source_keyword", "members_raw"];
  const esc = (v: unknown) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))];
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
}

(async () => {
  if (!fs.existsSync(SESSION_PATH)) {
    console.error(`No FB session at ${SESSION_PATH}.`);
    console.error("Run: npm run discover:facebook:auth");
    process.exit(1);
  }

  const config: KeywordsConfig = JSON.parse(fs.readFileSync(KEYWORDS_PATH, "utf-8"));
  console.log(`Loaded ${config.keywords.length} keywords. Mode: ${isHeaded ? "headed" : "headless"}${isDebug ? " (debug)" : ""}`);

  const browser = await chromium.launch({ headless: !isHeaded });
  const ctx     = await browser.newContext({
    storageState: SESSION_PATH,
    viewport:     { width: 1280, height: 900 },
  });
  const page    = await ctx.newPage();

  const allGroups = new Map<string, GroupRow>();
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  for (const keyword of config.keywords) {
    console.log(`\nSearching: ${keyword}`);
    const searchUrl = `https://www.facebook.com/search/groups?q=${encodeURIComponent(keyword)}`;

    try {
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(throttle([3000, 5000])); // initial render

      // Detect "log in" page (session expired)
      const url = page.url();
      if (url.includes("/login") || url.includes("/checkpoint")) {
        console.error("Facebook redirected to a login or checkpoint page - the session has expired or been challenged.");
        console.error("Run: npm run discover:facebook:auth");
        await browser.close();
        process.exit(2);
      }

      // Scroll passes
      for (let i = 0; i < config.scroll_passes; i++) {
        await page.keyboard.press("End");
        await sleep(throttle(config.throttle_ms));
      }

      const groups = await extractGroupsFromPage(page, keyword);
      console.log(`  Extracted ${groups.length} groups from this keyword`);

      if (isDebug && groups.length === 0) {
        const shotPath = path.join(RESULTS_DIR, `debug-${keyword.replace(/\s+/g, "_")}-${Date.now()}.png`);
        await page.screenshot({ path: shotPath, fullPage: true });
        console.log(`  Saved debug screenshot to ${shotPath}`);
      }

      for (const g of groups) {
        if (!allGroups.has(g.url)) {
          allGroups.set(g.url, g);
        } else {
          // If we've seen this group already, append the new keyword to the source
          const existing = allGroups.get(g.url)!;
          if (!existing.source_keyword.includes(g.source_keyword)) {
            existing.source_keyword = `${existing.source_keyword}, ${g.source_keyword}`;
          }
        }
      }
      console.log(`  Total unique: ${allGroups.size}`);

      // Pause between keywords
      await sleep(throttle(config.throttle_ms));
    } catch (e) {
      console.error(`  Error searching for "${keyword}":`, e instanceof Error ? e.message : e);
    }
  }

  // Score + filter + sort
  const scored = [...allGroups.values()].map(g => ({ ...g, score: scoreGroup(g, config) }));
  const passing = scored.filter(g => g.members >= config.thresholds.min_members);
  passing.sort((a, b) => b.score - a.score);

  console.log(`\nTotal unique groups found: ${scored.length}`);
  console.log(`Passing threshold (>= ${config.thresholds.min_members} members): ${passing.length}`);

  // Write the passing-threshold CSV (for review + append-to-workbook)
  const date = new Date().toISOString().slice(0, 10);
  const csvPath = path.join(RESULTS_DIR, `fb-discovery-${date}.csv`);
  writeCSV(csvPath, passing);

  // Also write a "raw" CSV with everything so we can sanity-check what was filtered out
  const rawPath = path.join(RESULTS_DIR, `fb-discovery-${date}-raw.csv`);
  scored.sort((a, b) => b.score - a.score);
  writeCSV(rawPath, scored);

  console.log(`\nResults written:`);
  console.log(`  ${csvPath}  (passing threshold, sorted by score)`);
  console.log(`  ${rawPath}  (everything found, for inspection)`);
  console.log(`\nNext step: run 'npm run discover:facebook:append' to add passing results to the Communities workbook.`);

  await browser.close();
  process.exit(0);
})().catch(e => {
  console.error("Discovery failed:", e);
  process.exit(1);
});
