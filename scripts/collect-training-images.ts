/**
 * Card Training Image Collector
 * Run:
 *   $env:EBAY_PROD_APP_ID  = "..."
 *   $env:EBAY_PROD_CERT_ID = "..."
 *   npx tsx scripts/collect-training-images.ts
 */

import * as fs   from "fs";
import * as path from "path";

const OUT_DIR  = "C:\\cardtraining";
const DELAY_MS = 450;
const IMG_SIZE = 800;

// Words in the listing title that indicate it's a supply/product listing
// rather than an actual card — skip these
const SUPPLY_WORDS = [
  "mystery box", "mystery pack", "mystery lot", "display case", "display stand",
  "acrylic case", "card holder lot", "toploader lot", "toploader pack",
  "penny sleeve lot", "sleeve lot", "one touch lot", "magnetic case lot",
  "empty", "bulk", "wholesale", "100 pack", "50 pack", "25 pack", "10 pack",
  "binder", "album", "storage box", "storage case", "card storage",
  "ultra pro lot", "bcw lot", "team bag lot",
];

function isSupplyListing(title: string): boolean {
  const t = title.toLowerCase();
  return SUPPLY_WORDS.some(w => t.includes(w));
}

const SCENARIOS: Array<{
  folder:  string;
  queries: string[];
  target:  number;
  note:    string;
}> = [
  {
    folder: "graded_psa",
    target: 20,
    note:   "PSA slabs — real graded cards of specific players",
    queries: [
      "Ken Griffey Jr PSA 10 rookie baseball card",
      "Shohei Ohtani PSA 10 rookie baseball card",
      "Mike Trout PSA 10 baseball card",
      "Patrick Mahomes PSA 10 rookie football card",
      "LeBron James PSA 10 rookie basketball card",
      "Derek Jeter PSA 9 baseball card",
      "Bo Jackson PSA 9 baseball card",
      "Aaron Judge PSA 10 baseball card",
      "Mickey Mantle PSA vintage baseball card",
      "Kobe Bryant PSA 10 basketball card",
      "Tom Brady PSA 10 rookie football card",
      "Justin Herbert PSA 10 rookie football card",
      "Luka Doncic PSA 10 rookie basketball card",
      "Nolan Ryan PSA graded baseball card",
      "Wayne Gretzky PSA hockey card graded",
    ],
  },
  {
    folder: "graded_psa_back",
    target: 8,
    note:   "PSA slabs showing card back",
    queries: [
      "PSA graded baseball card back",
      "PSA 9 baseball card 1980s vintage back",
      "PSA graded football card back stats",
      "PSA 10 rookie card back",
    ],
  },
  {
    folder: "graded_bgs",
    target: 12,
    note:   "BGS/Beckett slabs — label is at the BOTTOM",
    queries: [
      "Ken Griffey Jr BGS 9.5 baseball card",
      "Michael Jordan BGS 9.5 basketball card",
      "Tom Brady BGS 9.5 rookie football card",
      "Kobe Bryant BGS 9.5 basketball card",
      "Mike Trout BGS 9 baseball card",
      "LeBron James BGS 9.5 rookie basketball",
      "Aaron Rodgers BGS 9.5 football card",
      "Chipper Jones BGS graded baseball",
      "Frank Thomas BGS graded baseball card",
    ],
  },
  {
    folder: "graded_sgc",
    target: 10,
    note:   "SGC slabs — white case with colored label",
    queries: [
      "Mickey Mantle SGC graded baseball card",
      "Babe Ruth SGC vintage baseball card",
      "Derek Jeter SGC graded baseball card",
      "Hank Aaron SGC graded baseball card",
      "Willie Mays SGC baseball card",
      "Roger Clemens SGC graded card",
      "Nolan Ryan SGC graded baseball",
      "SGC 9 baseball card graded rookie",
    ],
  },
  {
    folder: "graded_cgc",
    target: 10,
    note:   "CGC graded cards — popular for Pokemon/TCG",
    queries: [
      "Charizard CGC 9 pokemon card",
      "Pikachu CGC graded pokemon card",
      "Base set pokemon CGC 9.5",
      "CGC 10 pokemon card rare",
      "Blastoise CGC graded pokemon",
      "Mewtwo CGC graded card",
      "CGC 9 baseball graded card",
      "first edition pokemon CGC graded",
    ],
  },
  {
    folder: "graded_hga",
    target: 8,
    note:   "HGA slabs — distinctive blue/purple frame",
    queries: [
      "HGA 9 graded baseball card rookie",
      "HGA graded football card slab",
      "HGA 10 basketball card graded",
      "hybrid grading HGA card slab",
      "HGA graded sports card slab",
    ],
  },
  {
    folder: "graded_other",
    target: 6,
    note:   "ACE, GAI, BCCG and other graders",
    queries: [
      "GAI graded baseball card vintage",
      "BCCG 10 graded baseball card",
      "ACE authentic graded card slab",
      "ISA graded baseball card",
      "Arena Club graded card",
      "SGSB graded baseball card",
    ],
  },
  {
    folder: "raw_toploader",
    target: 15,
    note:   "Actual cards inside toploaders",
    queries: [
      "Ken Griffey Jr rookie 1989 toploader",
      "baseball rookie card toploader ungraded 1990s",
      "Derek Jeter toploader rookie baseball card",
      "football rookie card toploader ungraded",
      "Nolan Ryan toploader vintage baseball",
      "basketball rookie card toploader raw ungraded",
      "Patrick Mahomes toploader rookie card",
      "baseball card toploader 1980s raw",
      "Kobe Bryant toploader raw basketball card",
      "Shohei Ohtani toploader baseball card",
      "vintage baseball card toploader ungraded",
    ],
  },
  {
    folder: "raw_toploader_sleeve",
    target: 8,
    note:   "Card in sleeve inside toploader",
    queries: [
      "baseball card sleeve toploader raw rookie",
      "football card penny sleeve toploader ungraded",
      "basketball card sleeve toploader ungraded",
      "vintage baseball card sleeve toploader",
    ],
  },
  {
    folder: "raw_onetouch",
    target: 10,
    note:   "Cards in magnetic one-touch holders",
    queries: [
      "baseball card one touch magnetic rookie",
      "Ken Griffey Jr one touch card",
      "football rookie card one touch magnetic",
      "basketball card ultra pro one touch",
      "vintage baseball card magnetic holder one touch",
      "Mike Trout one touch card",
    ],
  },
  {
    folder: "raw_sleeve_only",
    target: 6,
    note:   "Card in just a penny sleeve",
    queries: [
      "baseball card penny sleeve raw ungraded rookie",
      "vintage baseball card sleeve only raw",
      "football card penny sleeve ungraded raw",
    ],
  },
  {
    folder: "raw_bare",
    target: 12,
    note:   "Bare cards with no holder",
    queries: [
      "1989 Ken Griffey Jr Topps rookie raw ungraded",
      "baseball card raw ungraded vintage 1980s",
      "football card raw ungraded rookie",
      "basketball card raw ungraded",
      "1952 Topps baseball card raw ungraded",
      "Nolan Ryan raw baseball card ungraded",
      "Bo Jackson raw baseball card",
      "vintage baseball card ungraded raw",
    ],
  },
  {
    folder: "graded_psa_closeup",
    target: 8,
    note:   "PSA slabs photographed close-up — card fills most of frame",
    queries: [
      "PSA 10 baseball card rookie 2020",
      "PSA 10 rookie card 2021 2022 baseball",
      "PSA 10 graded card baseball 2019",
      "PSA 9 graded baseball card football",
    ],
  },
];

// ─── eBay API ─────────────────────────────────────────────────────────────────

async function getEbayToken(appId: string, certId: string): Promise<string> {
  const creds = Buffer.from(`${appId}:${certId}`).toString("base64");
  const res   = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method:  "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body:    "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  if (!res.ok) throw new Error(`eBay auth failed: ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

interface EbayItem { itemId: string; title: string; image?: { imageUrl: string }; thumbnailImages?: Array<{ imageUrl: string }> }

async function searchEbay(token: string, query: string): Promise<EbayItem[]> {
  const params = new URLSearchParams({ q: query, limit: "50", category_ids: "212" });
  const res = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
    headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  Search failed (${res.status}): ${err.slice(0, 120)}`);
    return [];
  }
  return ((await res.json()) as { itemSummaries?: EbayItem[] }).itemSummaries ?? [];
}

async function downloadImage(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url.replace(/s-l\d+(\.\w+)$/, `s-l${IMG_SIZE}$1`));
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15_000) return false;
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

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Authenticating with eBay...");
  const token = await getEbayToken(appId, certId);
  console.log("✓ Authenticated\n");

  let grandTotal = 0;

  for (const scenario of SCENARIOS) {
    const dir      = path.join(OUT_DIR, scenario.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const existing = fs.readdirSync(dir).filter(f => f.endsWith(".jpg")).length;
    if (existing >= scenario.target) {
      console.log(`─── ${scenario.folder} — already have ${existing}, skipping`);
      grandTotal += existing;
      continue;
    }

    let   saved = existing;
    const seen  = new Set<string>();
    console.log(`─── ${scenario.folder} (have ${existing}, want ${scenario.target})`);
    console.log(`    ${scenario.note}`);

    for (const q of scenario.queries) {
      if (saved >= scenario.target) break;
      console.log(`    Searching: "${q}"`);
      await sleep(DELAY_MS);

      const items = await searchEbay(token, q);
      let skipped = 0;

      for (const item of items) {
        if (saved >= scenario.target) break;
        if (seen.has(item.itemId)) continue;
        seen.add(item.itemId);

        // Skip supply/product listings
        if (isSupplyListing(item.title)) { skipped++; continue; }

        const imgUrl = item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl;
        if (!imgUrl) continue;

        await sleep(100);
        const filename = `${scenario.folder}_${String(saved + 1).padStart(3, "0")}.jpg`;
        const ok = await downloadImage(imgUrl, path.join(dir, filename));
        if (ok) {
          saved++;
          console.log(`    [${saved}/${scenario.target}] ${filename} — ${item.title.slice(0, 65)}`);
        }
      }

      if (skipped > 0) console.log(`    (skipped ${skipped} supply/product listings)`);
    }

    grandTotal += saved;
    console.log(`    ${saved >= scenario.target ? "✓" : `⚠  got ${saved}/${scenario.target}`}\n`);
  }

  console.log("══════════════════════════════════════════════════");
  console.log(`✓ Done. ${grandTotal} total images in ${OUT_DIR}`);
  console.log("══════════════════════════════════════════════════");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
