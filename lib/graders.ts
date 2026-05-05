/**
 * Grader API lookup layer.
 * Abstracts PSA / BGS / SGC / CGC behind a single interface.
 * Provider swappable — add credentials per grader in .env.
 */

export interface GraderCardData {
  certNumber: string;
  grader: string;
  player: string | null;
  year: number | null;
  manufacturer: string | null;
  set: string | null;
  subset: string | null;
  cardNumber: string | null;
  grade: string | null;
  sport: string | null;
}

// ─── Brand → Manufacturer lookup ─────────────────────────────────────────────
// PSA's Brand field is the product/set name (e.g. "BOWMAN CHROME"), not the
// parent company. We derive the manufacturer so collectors see the right hierarchy:
//   Manufacturer = Topps  |  Set = Bowman Chrome  |  Subset = Refractor

function deriveManufacturer(brand: string): string | null {
  const b = brand.toUpperCase();

  // Topps and its brands
  if (/\bTOPPS\b/.test(b))                 return "Topps";
  if (/\bBOWMAN\b/.test(b))               return "Topps";
  if (/\bSTADIUM CLUB\b/.test(b))          return "Topps";
  if (/\bFINEST\b/.test(b))               return "Topps";
  if (/\bHERITAGE\b/.test(b))             return "Topps";
  if (/\bGYPSY QUEEN\b/.test(b))          return "Topps";
  if (/\bOPENING DAY\b/.test(b))          return "Topps";
  if (/\bGALLERY\b/.test(b))             return "Topps";
  if (/\bARCHIVES\b/.test(b))            return "Topps";

  // Panini and its brands
  if (/\bPANINI\b/.test(b))               return "Panini";
  if (/\bPRIZM\b/.test(b))               return "Panini";
  if (/\bSELECT\b/.test(b))              return "Panini";
  if (/\bDONRUSS\b/.test(b))             return "Panini";
  if (/\bSCORE\b/.test(b))               return "Panini";
  if (/\bOPTIC\b/.test(b))               return "Panini";
  if (/\bCONTENDERS\b/.test(b))          return "Panini";
  if (/\bNATIONAL TREASURES\b/.test(b))  return "Panini";
  if (/\bIMMACULATE\b/.test(b))          return "Panini";
  if (/\bFLAWLESS\b/.test(b))            return "Panini";
  if (/\bMOSAIC\b/.test(b))              return "Panini";
  if (/\bCROWN ROYALE\b/.test(b))        return "Panini";
  if (/\bCHRONICLES\b/.test(b))          return "Panini";

  // Upper Deck and its brands
  if (/\bUPPER DECK\b/.test(b))           return "Upper Deck";
  if (/\b\bSPX?\b/.test(b))               return "Upper Deck";
  if (/\bARTIFACTS\b/.test(b))           return "Upper Deck";
  if (/\bO-PEE-CHEE\b/.test(b))          return "Upper Deck";
  if (/\bE-MOTION\b/.test(b))            return "Upper Deck";
  if (/\bSP AUTHENTIC\b/.test(b))        return "Upper Deck";

  // Fleer (independent brand before Panini acquisition)
  if (/\bFLEER\b/.test(b))               return "Fleer";
  if (/\bULTRA\b/.test(b))               return "Fleer";

  return null; // unknown — user fills in manufacturer manually
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b(\w)/g, c => c.toUpperCase());
}

// ─── PSA ─────────────────────────────────────────────────────────────────────
// Free tier: 100 calls/day.
// Supports two auth modes (whichever env vars are present):
//   PSA_ACCESS_TOKEN — pre-issued bearer token (simplest)
//   PSA_CLIENT_ID + PSA_CLIENT_SECRET — OAuth client credentials flow

async function getPSAToken(): Promise<string | null> {
  // Mode 1: pre-issued bearer token
  if (process.env.PSA_ACCESS_TOKEN) return process.env.PSA_ACCESS_TOKEN;

  // Mode 2: OAuth client credentials
  const id     = process.env.PSA_CLIENT_ID;
  const secret = process.env.PSA_CLIENT_SECRET;
  if (!id || !secret) return null;

  try {
    const res = await fetch("https://api.psacard.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials", client_id: id, client_secret: secret,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

async function lookupPSA(certNumber: string): Promise<GraderCardData | null> {
  const token = await getPSAToken();
  if (!token) return null;

  try {
    const res = await fetch(
      `https://api.psacard.com/publicapi/cert/GetByCertNumber/${certNumber}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const body = await res.json();
    const PSACert = body.PSACert;
    if (!PSACert) return null;

    // Parse grade number from description e.g. "NM-MT 8" → "8"
    const gradeMatch = PSACert.GradeDescription?.match(/(\d+(?:\.\d+)?)\s*$/);
    const grade = gradeMatch ? gradeMatch[1] : PSACert.GradeDescription ?? null;

    // Brand = PSA's product/set name (e.g. "BOWMAN CHROME", "TOPPS", "PRIZM").
    // We title-case it for the set field and derive the parent manufacturer.
    // Variety = subset variation (e.g. "FUTURE STARS", "REFRACTOR", "GOLD").
    const rawBrand  = (PSACert.Brand ?? "").trim();
    const rawVariety = (PSACert.Variety ?? "").trim();

    const setName    = rawBrand   ? titleCase(rawBrand)   : null;
    const subsetName = rawVariety ? titleCase(rawVariety) : null;
    const mfr        = deriveManufacturer(rawBrand);

    return {
      certNumber,
      grader:       "PSA",
      player:       PSACert.Subject ? titleCase(PSACert.Subject) : null,
      year:         PSACert.Year       ? parseInt(PSACert.Year) : null,
      manufacturer: mfr ?? setName,   // fall back to set name if manufacturer unknown
      set:          setName,
      subset:       subsetName,
      cardNumber:   PSACert.CardNumber ?? null,
      grade,
      sport:        PSACert.Sport      ?? null,
    };
  } catch {
    return null;
  }
}

// ─── SGC ─────────────────────────────────────────────────────────────────────
// SGC has a public-ish endpoint. Add PSA-style fields when available.
async function lookupSGC(certNumber: string): Promise<GraderCardData | null> {
  // SGC doesn't publish an official API — return cert number only for now.
  // Phase 2 enhancement: scrape sgccard.com/set-registry or await partner key.
  return {
    certNumber, grader: "SGC",
    player: null, year: null, manufacturer: null,
    set: null, subset: null, cardNumber: null, grade: null, sport: null,
  };
}

// ─── BGS / CGC ───────────────────────────────────────────────────────────────
async function lookupBGS(certNumber: string): Promise<GraderCardData | null> {
  return {
    certNumber, grader: "BGS",
    player: null, year: null, manufacturer: null,
    set: null, subset: null, cardNumber: null, grade: null, sport: null,
  };
}

async function lookupCGC(certNumber: string): Promise<GraderCardData | null> {
  return {
    certNumber, grader: "CGC",
    player: null, year: null, manufacturer: null,
    set: null, subset: null, cardNumber: null, grade: null, sport: null,
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export async function lookupCert(
  certNumber: string,
  grader: string
): Promise<GraderCardData | null> {
  switch (grader.toUpperCase()) {
    case "PSA":     return lookupPSA(certNumber);
    case "BGS":     return lookupBGS(certNumber);
    case "SGC":     return lookupSGC(certNumber);
    case "CGC":     return lookupCGC(certNumber);
    default:        return lookupPSA(certNumber) ?? { // try PSA as best guess
      certNumber, grader: "Unknown",
      player: null, year: null, manufacturer: null,
      set: null, subset: null, cardNumber: null, grade: null, sport: null,
    };
  }
}
