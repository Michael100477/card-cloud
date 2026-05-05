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
  cardNumber: string | null;
  grade: string | null;
  sport: string | null;
}

// ─── PSA ─────────────────────────────────────────────────────────────────────
// Free tier: 100 calls/day. Requires OAuth client credentials.
// Docs: https://www.psacard.com/cert/api/

async function getPSAToken(): Promise<string | null> {
  const id     = process.env.PSA_CLIENT_ID;
  const secret = process.env.PSA_CLIENT_SECRET;
  if (!id || !secret) return null;

  try {
    const res = await fetch("https://api.psacard.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     id,
        client_secret: secret,
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
    const { PSACert } = await res.json();
    if (!PSACert) return null;

    // Parse grade number from description e.g. "GEM MT 10" → "10"
    const gradeMatch = PSACert.GradeDescription?.match(/(\d+(?:\.\d+)?)\s*$/);
    const grade = gradeMatch ? gradeMatch[1] : PSACert.GradeDescription ?? null;

    return {
      certNumber,
      grader:       "PSA",
      player:       PSACert.Subject     ?? null,
      year:         PSACert.Year        ? parseInt(PSACert.Year) : null,
      manufacturer: PSACert.Brand       ?? null,
      set:          PSACert.SpecNumber  ?? null,
      cardNumber:   PSACert.CardNumber  ?? null,
      grade,
      sport:        null, // PSA API doesn't always expose sport
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
    set: null, cardNumber: null, grade: null, sport: null,
  };
}

// ─── BGS / CGC ───────────────────────────────────────────────────────────────
async function lookupBGS(certNumber: string): Promise<GraderCardData | null> {
  return {
    certNumber, grader: "BGS",
    player: null, year: null, manufacturer: null,
    set: null, cardNumber: null, grade: null, sport: null,
  };
}

async function lookupCGC(certNumber: string): Promise<GraderCardData | null> {
  return {
    certNumber, grader: "CGC",
    player: null, year: null, manufacturer: null,
    set: null, cardNumber: null, grade: null, sport: null,
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
      set: null, cardNumber: null, grade: null, sport: null,
    };
  }
}
