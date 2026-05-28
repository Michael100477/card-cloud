/**
 * Downloads 100 diverse raw/ungraded card photos — max 3 per search query
 * so we get a wide variety of players, sports, eras, and card types.
 *
 * Run:
 *   $env:EBAY_PROD_APP_ID  = "..."
 *   $env:EBAY_PROD_CERT_ID = "..."
 *   npx tsx scripts/collect-raw-cards.ts
 */

import * as fs   from "fs";
import * as path from "path";

const OUT_FOLDER     = "C:\\cardtraining\\raw_unsorted";
const TARGET         = 300;
const MAX_PER_QUERY  = 3;   // ← hard cap so no single player dominates
const DELAY_MS       = 380;
const IMG_SIZE       = 800;

const SUPPLY_WORDS = ["100 pack", "50 pack", "25 pack", "display case", "binder", "album", "storage box", "wholesale", "bulk"];
function isSupply(t: string) { return SUPPLY_WORDS.some(w => t.toLowerCase().includes(w)); }

const GRADE_WORDS = [" PSA ", " PSA-", " BGS ", " SGC ", " CGC ", " HGA ", " GAI ", "PSA 10", "PSA 9", "BGS 9", "BGS 10", "SGC 9", "CGC 9"];
function isGraded(t: string) { return GRADE_WORDS.some(w => t.includes(w)); }

// ─── 50+ diverse queries — 3 images each = plenty of variety ──────────────────
const QUERIES = [
  // ── Modern baseball (2010s–2020s) ──────────────────────────────────────
  "Mike Trout 2011 Topps Update rookie baseball",
  "Bryce Harper 2012 Topps rookie baseball card",
  "Kris Bryant 2015 Topps rookie baseball card",
  "Cody Bellinger 2017 Topps rookie baseball",
  "Aaron Judge 2017 Topps rookie baseball card",
  "Fernando Tatis Jr 2019 Topps rookie baseball",
  "Juan Soto 2018 Topps Update rookie baseball",
  "Ronald Acuna Jr 2018 Topps rookie baseball",
  "Wander Franco 2021 Topps Chrome rookie",
  "Julio Rodriguez 2022 Topps Chrome rookie",
  "Bobby Witt Jr 2022 Topps Chrome rookie",
  "Gunnar Henderson 2023 Topps Chrome rookie",
  "Jackson Holliday 2024 Topps Chrome rookie",
  "Paul Skenes 2024 Topps Chrome rookie",
  "Elly De La Cruz 2023 Topps Chrome rookie",
  "Spencer Strider 2022 Topps rookie baseball",
  "Yordan Alvarez 2019 Topps Chrome rookie",
  "Pete Alonso 2019 Topps rookie baseball",
  "Vladimir Guerrero Jr 2019 Topps Chrome rookie",
  "Bo Bichette 2020 Topps rookie baseball card",
  "Shohei Ohtani 2018 Topps Chrome rookie",
  "Kyle Tucker 2019 Topps rookie baseball",
  "Jazz Chisholm 2021 Topps Chrome rookie",
  "Riley Greene 2022 Topps Chrome rookie",
  "Corbin Carroll 2023 Topps Chrome rookie",

  // ── Modern football (2010s–2020s) ───────────────────────────────────────
  "Patrick Mahomes 2017 Panini Prizm rookie football",
  "Josh Allen 2018 Panini Prizm rookie football",
  "Lamar Jackson 2018 Panini Optic rookie football",
  "Justin Herbert 2020 Panini Prizm rookie football",
  "Joe Burrow 2020 Panini Prizm rookie football",
  "Justin Jefferson 2020 Panini Prizm rookie football",
  "Ja Marr Chase 2021 Panini Prizm rookie football",
  "Cooper Kupp 2017 Panini Prizm rookie football",
  "Davante Adams 2014 Panini Prizm rookie football",
  "Tyreek Hill 2016 Panini Prizm rookie football",
  "CJ Stroud 2023 Panini Prizm rookie football",
  "Bijan Robinson 2023 Panini Prizm rookie football",
  "Bryce Young 2023 Panini Prizm rookie football",
  "Caleb Williams 2024 Panini Prizm rookie football",
  "Drake Maye 2024 Panini Prizm rookie football",
  "Marvin Harrison Jr 2024 Panini rookie football",
  "DK Metcalf 2019 Panini Prizm rookie football",
  "Deebo Samuel 2019 Panini Prizm rookie football",
  "Tua Tagovailoa 2020 Panini Prizm rookie football",
  "Trevor Lawrence 2021 Panini Prizm rookie football",
  "Kyle Pitts 2021 Panini Prizm rookie football",
  "Najee Harris 2021 Panini Prizm rookie football",
  "Mac Jones 2021 Panini Prizm rookie football",
  "Jaylen Waddle 2021 Panini Prizm rookie football",
  "Garrett Wilson 2022 Panini Prizm rookie football",

  // ── Modern basketball (2010s–2020s) ─────────────────────────────────────
  "Luka Doncic 2018 Panini Prizm rookie basketball",
  "Zion Williamson 2019 Panini Prizm rookie basketball",
  "Ja Morant 2019 Panini Prizm rookie basketball",
  "Trae Young 2018 Panini Prizm rookie basketball",
  "Donovan Mitchell 2017 Panini Prizm rookie basketball",
  "Jayson Tatum 2017 Panini Prizm rookie basketball",
  "Ben Simmons 2016 Panini Prizm rookie basketball",
  "Karl-Anthony Towns 2015 Panini Prizm rookie",
  "Devin Booker 2015 Panini Prizm rookie basketball",
  "Nikola Jokic 2015 Panini Prizm rookie basketball",
  "Joel Embiid 2014 Panini Prizm rookie basketball",
  "Andrew Wiggins 2014 Panini Prizm rookie basketball",
  "Victor Wembanyama 2023 Panini Prizm rookie basketball",
  "Chet Holmgren 2022 Panini Prizm rookie basketball",
  "Paolo Banchero 2022 Panini Prizm rookie basketball",
  "Scottie Barnes 2021 Panini Prizm rookie basketball",
  "Cade Cunningham 2021 Panini Prizm rookie basketball",
  "Evan Mobley 2021 Panini Prizm rookie basketball",
  "Anthony Edwards 2020 Panini Prizm rookie basketball",
  "LaMelo Ball 2020 Panini Prizm rookie basketball",
  "Tyrese Haliburton 2020 Panini Prizm rookie basketball",
  "Franz Wagner 2021 Panini Prizm rookie basketball",
  "Jabari Smith Jr 2022 Panini Prizm rookie basketball",
  "Scoot Henderson 2023 Panini Prizm rookie basketball",
  "Brandon Miller 2023 Panini Prizm rookie basketball",

  // ── Modern hockey (2010s–2020s) ─────────────────────────────────────────
  "Connor McDavid 2015 Upper Deck Young Guns rookie",
  "Nathan MacKinnon 2013 Upper Deck Young Guns rookie",
  "Leon Draisaitl 2015 Upper Deck Young Guns rookie",
  "Auston Matthews 2016 Upper Deck Young Guns rookie",
  "Mitch Marner 2016 Upper Deck Young Guns rookie",
  "Jack Eichel 2015 Upper Deck Young Guns rookie",
  "David Pastrnak 2014 Upper Deck Young Guns rookie",
  "Mark Scheifele 2013 Upper Deck Young Guns rookie",
  "Johnny Gaudreau 2013 Upper Deck Young Guns rookie",
  "Aleksander Barkov 2013 Upper Deck Young Guns rookie",
  "Matthew Tkachuk 2016 Upper Deck Young Guns rookie",
  "Brady Tkachuk 2018 Upper Deck Young Guns rookie",
  "Elias Pettersson 2018 Upper Deck Young Guns rookie",
  "Rasmus Dahlin 2018 Upper Deck Young Guns rookie",
  "Cale Makar 2019 Upper Deck Young Guns rookie",
  "Quinn Hughes 2019 Upper Deck Young Guns rookie",
  "Moritz Seider 2021 Upper Deck Young Guns rookie",
  "Trevor Zegras 2021 Upper Deck Young Guns rookie",
  "Owen Power 2022 Upper Deck Young Guns rookie",
  "Shane Wright 2022 Upper Deck Young Guns rookie",

  // ── Modern Pokemon & TCG (2010s–2020s) ──────────────────────────────────
  "Charizard VMAX 2020 Sword Shield pokemon card",
  "Pikachu V 2021 Celebrations pokemon card",
  "Umbreon VMAX 2021 Evolving Skies pokemon card",
  "Sylveon VMAX 2021 Evolving Skies pokemon card",
  "Rayquaza VMAX 2021 Evolving Skies pokemon card",
  "Giratina VSTAR 2022 Lost Origin pokemon card",
  "Charizard ex 2023 Obsidian Flames pokemon card",
  "Lugia VSTAR 2022 Silver Tempest pokemon card",
  "Mewtwo VSTAR 2022 Pokemon Go card",
  "Mew VMAX 2022 Fusion Strike pokemon card",
  "Pikachu VMAX 2020 Vivid Voltage rainbow pokemon",
  "Snorlax VMAX 2020 Sword Shield pokemon card",
  "Eevee Heroes VMAX 2021 Japanese pokemon card",
  "Alakazam ex 2023 151 pokemon card",
  "Charizard 2016 Pokemon Evolutions holo",

  // ── Mixed modern sets ────────────────────────────────────────────────────
  "2021 Topps Chrome baseball refractor card",
  "2022 Bowman Chrome baseball prospect card",
  "2023 Topps baseball rookie card",
  "2020 Panini Mosaic football rookie card",
  "2021 Panini Donruss football rookie card",
  "2022 Panini Donruss basketball rookie card",
  "2023 Upper Deck hockey Young Guns card",
  "2021 Topps Chrome baseball pink refractor",
  "2022 Panini Select football rookie card",
  "2023 Bowman baseball chrome prospect",

  // ── Baseball — classic rookies ──────────────────────────────────────────
  "Nolan Ryan 1968 Topps rookie baseball card",
  "Pete Rose 1963 Topps baseball card",
  "Reggie Jackson 1969 Topps rookie",
  "George Brett 1975 Topps rookie baseball",
  "Mike Schmidt 1973 Topps rookie baseball",
  "Johnny Bench 1968 Topps rookie",
  "Tom Seaver 1967 Topps rookie",
  "Rod Carew 1967 Topps rookie baseball",
  "Steve Carlton 1965 Topps baseball card",
  "Carl Yastrzemski 1960 Topps baseball",
  "Brooks Robinson 1957 Topps rookie",
  "Harmon Killebrew 1955 Topps baseball",
  "Frank Robinson 1957 Topps baseball",
  "Al Kaline 1954 Topps baseball card",
  "Ernie Banks 1954 Topps baseball",
  "Yogi Berra 1952 Topps baseball card",
  "Duke Snider 1952 Topps baseball",
  "Phil Rizzuto 1952 Topps baseball",

  // ── Baseball — 80s & 90s stars ──────────────────────────────────────────
  "Roger Clemens 1984 Fleer Update rookie",
  "Dwight Gooden 1984 Topps Traded rookie",
  "Don Mattingly 1984 Donruss rookie baseball",
  "Kirby Puckett 1985 Topps rookie baseball",
  "Jose Canseco 1986 Fleer rookie baseball",
  "Mark McGwire 1987 Topps rookie baseball",
  "Darryl Strawberry 1983 Topps rookie",
  "Wade Boggs 1983 Topps rookie baseball",
  "Ryne Sandberg 1983 Donruss rookie",
  "Tony Gwynn 1983 Fleer rookie baseball",
  "Cal Ripken 1982 Donruss rookie baseball",
  "Ozzie Smith 1979 Topps rookie baseball",
  "Dave Winfield 1974 Topps rookie",
  "Robin Yount 1975 Topps rookie baseball",
  "Paul Molitor 1978 Topps rookie baseball",
  "Rickey Henderson 1980 Topps rookie",
  "Tim Raines 1982 Topps rookie baseball",
  "Andre Dawson 1977 Topps rookie",
  "Dale Murphy 1977 Topps rookie baseball",
  "Gary Carter 1975 Topps rookie baseball",

  // ── Baseball — modern stars ─────────────────────────────────────────────
  "Albert Pujols 2001 Bowman rookie baseball",
  "Ichiro Suzuki 2001 Topps rookie baseball",
  "David Ortiz 1997 Topps rookie baseball",
  "Randy Johnson 1989 Fleer rookie baseball",
  "Greg Maddux 1987 Donruss rookie baseball",
  "Pedro Martinez 1992 Topps rookie baseball",
  "Chipper Jones 1993 Topps rookie baseball",
  "Jim Thome 1991 Bowman rookie baseball",
  "Alex Rodriguez 1994 Topps rookie baseball",
  "Frank Thomas 1990 Topps rookie baseball",

  // ── Football ────────────────────────────────────────────────────────────
  "Joe Montana 1979 Topps rookie football",
  "Dan Marino 1983 Topps rookie football",
  "Walter Payton 1976 Topps rookie football",
  "Lawrence Taylor 1982 Topps rookie football",
  "Eric Dickerson 1983 Topps rookie football",
  "John Elway 1983 Topps rookie football",
  "Jim McMahon 1983 Topps rookie football",
  "Tony Dorsett 1977 Topps rookie football",
  "Franco Harris 1972 Topps rookie football",
  "Terry Bradshaw 1971 Topps rookie football",
  "Roger Staubach 1972 Topps rookie football",
  "Fran Tarkenton 1962 Topps rookie football",
  "Steve Young 1984 Topps rookie football",
  "Jim Kelly 1984 Topps rookie football",
  "Thurman Thomas 1989 Score rookie football",
  "Deion Sanders 1989 Score rookie football",
  "Dexter Manley 1982 Topps football",
  "Ronnie Lott 1982 Topps rookie football",
  "Jerry Rice 1986 Topps rookie football",
  "Andre Reed 1986 Topps rookie football",
  "Sterling Sharpe 1988 Topps rookie football",
  "Reggie White 1986 Topps rookie football",
  "Mike Singletary 1982 Topps rookie football",
  "Ozzie Newsome 1979 Topps rookie football",

  // ── Basketball ──────────────────────────────────────────────────────────
  "Larry Bird 1981 Topps basketball card",
  "Magic Johnson 1981 Topps basketball",
  "Julius Erving 1977 Topps basketball",
  "Moses Malone 1975 Topps basketball",
  "Bill Walton 1977 Topps basketball",
  "Kareem Abdul-Jabbar 1972 Topps basketball",
  "Oscar Robertson 1961 Fleer basketball",
  "Jerry West 1961 Fleer basketball",
  "Charles Barkley 1986 Fleer rookie basketball",
  "Hakeem Olajuwon 1984 Star rookie basketball",
  "Patrick Ewing 1985 Star rookie basketball",
  "John Stockton 1985 Star rookie basketball",
  "Karl Malone 1986 Fleer rookie basketball",
  "Clyde Drexler 1986 Fleer rookie basketball",
  "Isiah Thomas 1984 Star rookie basketball",
  "Reggie Miller 1988 Fleer rookie basketball",
  "Gary Payton 1991 Hoops rookie basketball",
  "Alonzo Mourning 1992 Topps rookie basketball",
  "Shaquille O'Neal 1992 Topps rookie basketball",
  "Penny Hardaway 1993 Topps rookie basketball",
  "Grant Hill 1994 Topps rookie basketball",
  "Jason Kidd 1994 Topps rookie basketball",
  "Allen Iverson 1996 Topps Chrome rookie",
  "Ray Allen 1996 Topps rookie basketball",
  "Paul Pierce 1998 Topps rookie basketball",
  "Vince Carter 1998 Topps Chrome rookie",
  "Dirk Nowitzki 1998 Topps Chrome rookie",
  "Tracy McGrady 1997 Topps Chrome rookie",
  "Dwyane Wade 2003 Topps rookie basketball",
  "Chris Paul 2005 Topps rookie basketball",
  "Carmelo Anthony 2003 Topps rookie basketball",

  // ── Hockey ──────────────────────────────────────────────────────────────
  "Bobby Orr 1966 Topps rookie hockey",
  "Guy Lafleur 1972 OPC rookie hockey",
  "Phil Esposito 1964 Topps hockey",
  "Gordie Howe 1951 Parkhurst hockey",
  "Jean Beliveau 1953 Parkhurst hockey",
  "Mark Messier 1980 OPC rookie hockey",
  "Mike Bossy 1978 OPC rookie hockey",
  "Bryan Trottier 1976 OPC rookie hockey",
  "Peter Stastny 1981 OPC rookie hockey",
  "Dale Hawerchuk 1982 OPC rookie hockey",
  "Steve Yzerman 1984 OPC rookie hockey",
  "Brett Hull 1987 OPC rookie hockey",
  "Jaromir Jagr 1991 OPC rookie hockey",
  "Martin Brodeur 1991 OPC rookie hockey",
  "Patrick Roy 1986 OPC rookie hockey",
  "Eric Lindros 1991 OPC Premier rookie",
  "Paul Kariya 1994 Donruss rookie hockey",
  "Teemu Selanne 1992 OPC rookie hockey",
  "Joe Sakic 1990 OPC Premier rookie hockey",
  "Mats Sundin 1991 OPC rookie hockey",

  // ── Pokemon ─────────────────────────────────────────────────────────────
  "Charizard 1999 Pokemon base set unlimited",
  "Blastoise 1999 Pokemon base set",
  "Venusaur 1999 Pokemon base set holo",
  "Raichu 1999 Pokemon base set holo",
  "Gengar 1999 Pokemon fossil holo",
  "Machamp 1999 Pokemon base set",
  "Alakazam 1999 Pokemon base set holo",
  "Chansey 1999 Pokemon base set holo",
  "Clefable 1999 Pokemon jungle holo",
  "Vaporeon 1999 Pokemon jungle holo",
  "Jolteon 1999 Pokemon jungle holo",
  "Flareon 1999 Pokemon jungle holo",
  "Scyther 1999 Pokemon jungle holo",
  "Pinsir 1999 Pokemon jungle holo",
  "Lapras 1999 Pokemon fossil holo",
  "Hypno 1999 Pokemon fossil holo",
  "Kabutops 1999 Pokemon fossil holo",
  "Aerodactyl 1999 Pokemon fossil holo",
  "Zapdos 2000 Pokemon base set 2",
  "Moltres 2000 Pokemon base set 2",
];

async function getEbayToken(appId: string, certId: string): Promise<string> {
  const creds = Buffer.from(`${appId}:${certId}`).toString("base64");
  const res   = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method:  "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body:    "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  if (!res.ok) throw new Error(`Auth failed: ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

interface EbayItem { itemId: string; title: string; image?: { imageUrl: string }; thumbnailImages?: Array<{ imageUrl: string }> }

async function search(token: string, q: string): Promise<EbayItem[]> {
  const params = new URLSearchParams({ q, limit: "20" });
  const res    = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
    headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
  });
  if (!res.ok) { console.error(`  eBay error ${res.status}`); return []; }
  return ((await res.json()) as { itemSummaries?: EbayItem[] }).itemSummaries ?? [];
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

async function main() {
  const appId  = process.env.EBAY_PROD_APP_ID  || "";
  const certId = process.env.EBAY_PROD_CERT_ID || "";
  if (!appId || !certId) { console.error("Set EBAY_PROD_APP_ID and EBAY_PROD_CERT_ID"); process.exit(1); }

  fs.mkdirSync(OUT_FOLDER, { recursive: true });

  // Count existing files to resume if interrupted
  const existing = fs.readdirSync(OUT_FOLDER).filter(f => f.endsWith(".jpg")).length;
  if (existing >= TARGET) { console.log(`Already have ${existing} images — done!`); return; }

  console.log(`Have ${existing} images, downloading ${TARGET - existing} more (max ${MAX_PER_QUERY} per search).\n`);

  console.log("Authenticating with eBay...");
  const token = await getEbayToken(appId, certId);
  console.log("✓ Authenticated\n");

  let   saved = existing;
  const seen  = new Set<string>();

  for (const q of QUERIES) {
    if (saved >= TARGET) break;
    process.stdout.write(`[${saved}/${TARGET}] "${q}" ... `);
    await sleep(DELAY_MS);

    const items = await search(token, q);
    process.stdout.write(`${items.length} results\n`);

    let fromThisQuery = 0;

    for (const item of items) {
      if (saved >= TARGET) break;
      if (fromThisQuery >= MAX_PER_QUERY) break;     // ← diversity cap
      if (seen.has(item.itemId)) continue;
      seen.add(item.itemId);

      if (isSupply(item.title) || isGraded(item.title)) continue;

      const imgUrl = item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl;
      if (!imgUrl) continue;

      await sleep(80);
      const filename = `raw_${String(saved + 1).padStart(3, "0")}.jpg`;
      const ok = await downloadImage(imgUrl, path.join(OUT_FOLDER, filename));
      if (ok) {
        saved++;
        fromThisQuery++;
        console.log(`  ✓ ${filename} — ${item.title.slice(0, 72)}`);
      }
    }
  }

  console.log(`\n✓ Done. ${saved} total images in ${OUT_FOLDER}`);
  console.log("Sort them into the correct holder folders, then upload to Admin → AI Lab → Photo Training");
}

main().catch(e => { console.error(e); process.exit(1); });
