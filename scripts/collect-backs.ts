/**
 * Card Back Image Collector
 *
 * Creates a "back" subfolder inside every existing C:\cardtraining folder,
 * then downloads the SECOND listing photo from eBay (always the card back)
 * using the Browse API item detail endpoint.
 *
 * Run:
 *   $env:EBAY_PROD_APP_ID  = "..."
 *   $env:EBAY_PROD_CERT_ID = "..."
 *   npx tsx scripts/collect-backs.ts
 */

import * as fs   from "fs";
import * as path from "path";

const TRAINING_ROOT = "C:\\cardtraining";
const TARGET        = 10;   // backs per folder
const IMG_SIZE      = 800;
const SEARCH_DELAY  = 400;
const ITEM_DELAY    = 200;  // item-detail calls — be gentle with rate limits

// ─── Scenarios: one per folder that needs backs ───────────────────────────────
// Queries should produce listings where sellers typically show front + back.

const SCENARIOS: Array<{ folder: string; queries: string[]; note: string }> = [
  {
    folder: "graded_psa",
    note:   "PSA slab backs — clear plastic showing card stats side",
    queries: [
      "PSA graded baseball card back",
      "PSA 10 baseball card back stats",
      "PSA graded football card",
      "PSA graded basketball card rookie",
      "PSA graded vintage baseball card",
    ],
  },
  {
    folder: "graded_bgs",
    note:   "BGS/Beckett slab backs",
    queries: [
      "BGS graded baseball card",
      "BGS 9.5 rookie football card",
      "Beckett graded baseball card vintage",
      "BGS graded basketball card",
    ],
  },
  {
    folder: "graded_sgc",
    note:   "SGC slab backs",
    queries: [
      "SGC graded baseball card vintage",
      "SGC graded rookie baseball",
      "SGC graded football card",
    ],
  },
  {
    folder: "graded_cgc",
    note:   "CGC slab backs",
    queries: [
      "CGC graded pokemon card",
      "CGC graded baseball card",
      "CGC 9 trading card",
    ],
  },
  {
    folder: "graded_hga",
    note:   "HGA slab backs",
    queries: [
      "HGA graded baseball card slab",
      "HGA graded rookie card",
    ],
  },
  {
    folder: "graded_other",
    note:   "Other grader slab backs (GAI, BCCG, etc.)",
    queries: [
      "GAI graded baseball card vintage",
      "BCCG graded baseball card",
    ],
  },
  {
    folder: "graded_psa_closeup",
    note:   "PSA slab backs — close-up shots",
    queries: [
      "PSA 10 rookie card 2020 baseball",
      "PSA 10 Topps Chrome rookie card",
    ],
  },
  {
    folder: "raw_bare",
    note:   "Bare card backs — stats and bio side",
    queries: [
      "1989 Topps Traded Ken Griffey Jr rookie",
      "1987 Topps Barry Bonds rookie",
      "1984 Donruss Don Mattingly rookie",
      "2017 Topps Aaron Judge rookie baseball",
      "2018 Topps Shohei Ohtani rookie baseball",
      "2019 Panini Prizm rookie football card",
      "2020 Panini Prizm basketball rookie",
    ],
  },
  {
    folder: "raw_toploader",
    note:   "Card backs visible through toploader",
    queries: [
      "Ken Griffey Jr 1989 rookie toploader",
      "Derek Jeter rookie toploader card",
      "baseball card toploader 1980s vintage",
      "football card toploader rookie",
      "2017 Topps baseball card toploader",
    ],
  },
  {
    folder: "raw_toploader_sleeve",
    note:   "Card backs in sleeve+toploader",
    queries: [
      "baseball rookie card sleeve toploader",
      "vintage baseball card sleeve toploader",
    ],
  },
  {
    folder: "raw_onetouch",
    note:   "Card backs in one-touch magnetic holder",
    queries: [
      "baseball card one touch magnetic rookie",
      "vintage baseball card one touch",
      "football card magnetic one touch rookie",
    ],
  },
  {
    folder: "raw_sleeve_only",
    note:   "Card backs in penny sleeve",
    queries: [
      "baseball card penny sleeve ungraded rookie",
      "vintage baseball card sleeve",
    ],
  },
  {
    folder: "raw_unsorted",
    note:   "Mixed raw card backs — all eras and sports",
    queries: [
      "1989 Topps Traded baseball card",
      "1975 Topps baseball card vintage",
      "2022 Topps Chrome baseball rookie card",
      "2021 Panini Prizm rookie football card",
      "2020 Panini Prizm basketball rookie",
      "1999 Pokemon base set card",
      "2018 Panini Prizm rookie football",
    ],
  },
];

// ─── eBay helpers ─────────────────────────────────────────────────────────────

async function getToken(appId: string, certId: string): Promise<string> {
  const creds = Buffer.from(`${appId}:${certId}`).toString("base64");
  const res   = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method:  "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body:    "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  if (!res.ok) throw new Error(`Auth failed: ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

interface Summary { itemId: string; title: string }
interface ItemDetail { additionalImages?: Array<{ imageUrl: string }> }

async function searchItems(token: string, q: string): Promise<Summary[]> {
  const params = new URLSearchParams({ q, limit: "30" });
  const res    = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
    headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
  });
  if (!res.ok) return [];
  return ((await res.json()) as { itemSummaries?: Summary[] }).itemSummaries ?? [];
}

/** Fetch the full item detail — this includes additionalImages (2nd, 3rd photo etc.) */
async function getItemDetail(token: string, itemId: string): Promise<ItemDetail | null> {
  const res = await fetch(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(itemId)}`, {
    headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
  });
  if (!res.ok) return null;
  return await res.json() as ItemDetail;
}

async function downloadImage(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url.replace(/s-l\d+(\.\w+)$/, `s-l${IMG_SIZE}$1`));
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 8_000) return false;
    fs.writeFileSync(dest, buf);
    return true;
  } catch { return false; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const appId  = process.env.EBAY_PROD_APP_ID  || "";
  const certId = process.env.EBAY_PROD_CERT_ID || "";
  if (!appId || !certId) { console.error("Set EBAY_PROD_APP_ID and EBAY_PROD_CERT_ID"); process.exit(1); }

  // Create all back subfolders first
  let createdFolders = 0;
  for (const s of SCENARIOS) {
    const parent = path.join(TRAINING_ROOT, s.folder);
    const backDir = path.join(parent, "back");
    if (!fs.existsSync(parent)) { console.warn(`  ⚠ ${s.folder} doesn't exist — skipping`); continue; }
    if (!fs.existsSync(backDir)) { fs.mkdirSync(backDir); createdFolders++; }
  }
  console.log(`Created ${createdFolders} back/ subfolders\n`);

  console.log("Authenticating with eBay...");
  const token = await getToken(appId, certId);
  console.log("✓ Authenticated\n");

  let grandTotal = 0;

  for (const scenario of SCENARIOS) {
    const parent = path.join(TRAINING_ROOT, scenario.folder);
    if (!fs.existsSync(parent)) continue;

    const backDir  = path.join(parent, "back");
    const existing = fs.readdirSync(backDir).filter(f => f.endsWith(".jpg")).length;

    if (existing >= TARGET) {
      console.log(`─── ${scenario.folder}/back — already have ${existing}, skipping`);
      grandTotal += existing;
      continue;
    }

    console.log(`─── ${scenario.folder}/back (have ${existing}, want ${TARGET})`);
    console.log(`    ${scenario.note}`);

    let   saved = existing;
    const seen  = new Set<string>();

    for (const q of scenario.queries) {
      if (saved >= TARGET) break;
      process.stdout.write(`    Searching: "${q}" ... `);
      await sleep(SEARCH_DELAY);

      const items = await searchItems(token, q);
      process.stdout.write(`${items.length} listings\n`);

      for (const item of items) {
        if (saved >= TARGET) break;
        if (seen.has(item.itemId)) continue;
        seen.add(item.itemId);

        // Fetch item detail to get the second (back) photo
        await sleep(ITEM_DELAY);
        const detail = await getItemDetail(token, item.itemId);
        if (!detail?.additionalImages?.length) continue;

        // additionalImages[0] = second listing photo = the card back
        const backUrl = detail.additionalImages[0].imageUrl;
        if (!backUrl) continue;

        const filename = `back_${String(saved + 1).padStart(3, "0")}.jpg`;
        const ok       = await downloadImage(backUrl, path.join(backDir, filename));
        if (ok) {
          saved++;
          console.log(`    [${saved}/${TARGET}] ${filename} — ${item.title.slice(0, 65)}`);
        }
      }
    }

    grandTotal += saved;
    console.log(`    ${saved >= TARGET ? "✓" : `⚠  got ${saved}/${TARGET}`}\n`);
  }

  console.log("══════════════════════════════════════════════════");
  console.log(`✓ Done. ${grandTotal} back images across all folders`);
  console.log("══════════════════════════════════════════════════");
}

main().catch(e => { console.error(e); process.exit(1); });
