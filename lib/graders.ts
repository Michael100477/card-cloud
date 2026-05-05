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

    // Log full response once so we can see every field PSA provides
    console.log("[PSA raw]", JSON.stringify(PSACert));

    // Parse grade number from description e.g. "NM-MT 8" → "8"
    const gradeMatch = PSACert.GradeDescription?.match(/(\d+(?:\.\d+)?)\s*$/);
    const grade = gradeMatch ? gradeMatch[1] : PSACert.GradeDescription ?? null;

    // SpecNumber is PSA's internal numeric catalog code — not human-readable.
    // Leave set null so the user fills it in; their card label shows the set name.
    // Variety (e.g. "FUTURE STARS") maps to subset.
    const isNumericOnly = (v: unknown) =>
      typeof v === "string" && /^\d+$/.test(v.trim());

    const setName = isNumericOnly(PSACert.SpecNumber)
      ? null
      : (PSACert.SpecNumber ?? null);

    const subset = PSACert.Variety && !isNumericOnly(PSACert.Variety)
      ? PSACert.Variety
      : null;

    return {
      certNumber,
      grader:       "PSA",
      player:       PSACert.Subject    ?? null,
      year:         PSACert.Year       ? parseInt(PSACert.Year) : null,
      manufacturer: PSACert.Brand      ?? null,
      set:          setName,
      subset,
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
