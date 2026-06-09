import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin, AdminError } from "@/lib/admin";

// ── Static system prompt — cached across all listing generation calls ─────
// Caching kicks in once this block has been seen before (≥1024 tokens for Haiku/Sonnet).
// Every call after the first gets a cache hit on this block, saving ~80% of input token cost.

// Phase 1 — title + pricing only (fast, ~3s). Description is generated separately.
const QUICK_SYSTEM = `You are an expert eBay trading card seller. Generate ONLY a search-optimized title and suggested prices for the card described. No description needed.

TITLE RULES:
- Maximum 80 characters — hard limit
- Required format: "Player Name - Year Manufacturer Set Subset Card# - #'d Serial Auto"
  - Lead with the player name, then " - ", then card details
  - Subset, serial number, and "Auto" are optional — include only if present
  - Use "#'d <serialNumber>" exactly (apostrophe-d), e.g. "#'d 058/300"
  - Use "Auto" (not "AUTO") at the end when autographed
- Example with everything: "Bo Jackson - 2002 Topps Archives Autoproofs #4 - #'d 058/300 Auto"
- Example minimal: "Bo Jackson - 1987 Topps #170"
- Example graded: "Mahomes - 2023 Prizm Silver #1 - PSA 10 Auto"
- Include grade + company if graded (e.g. "PSA 10", "BGS 9.5")
- Include "RC" for rookie cards when relevant
- No filler words. No repeated words or phrases.

PRICING RULES:
- Use seller's desired price exactly if provided
- Auctions: start at 0.99 for commons; market-based for graded
- suggestedBuyItNow: null for auctions unless clearly valuable (then 1.5-2x start)
- BIN: use desired price or market estimate

OUTPUT — return ONLY this JSON, nothing else:
{"title":"string max 80 chars","suggestedStartPrice":number,"suggestedBuyItNow":number|null}`;

// Phase 2 — description only (can be slower, runs while user reviews title/pricing).
const DESCRIPTION_SYSTEM = `You are an expert, enthusiastic eBay trading card seller writing emotionally engaging, collector-focused listing descriptions. Your descriptions use emojis to create energy and excitement, use section headers, and speak directly to what collectors care about.

STYLE & TONE:
- Enthusiastic, passionate, collector-to-collector voice
- Use emojis liberally — for section headers, bullet points, and emphasis
- Use ALL CAPS sparingly for grade designations and key terms (e.g. PSA 10 GEM MINT, ROOKIE CARD)
- Bullet points for card details and condition specifics
- Short punchy paragraphs — no walls of text
- Speak to why THIS specific card matters to a collector

STRUCTURE (adapt emoji choices to the sport/card type):
1. Opening hook paragraph — what the card is, grade, player — exciting and direct
2. "🌟 [Player Name] — Why This Card Matters" section — player significance, career context, collectibility
3. "📦 [Set Name] Design" section (if relevant) — what makes this set/design notable, brief bullet points
4. "💎 [Grade Company + Grade] — Condition Details" section — what the grade means, mid-grade vs high-grade context, bullet points listing the card's strengths (corners, edges, surface, centering)
5. "🔥 Why This Card Belongs in Your Collection" section — 4-5 emoji bullet points summarizing the key selling points
6. Closing line about shipping: "Ships fast and secure in its [PSA/BGS/etc.] slab." or for raw cards "Ships in a penny sleeve and top loader inside a bubble mailer, fully protected."

EMOJI GUIDANCE — match to the content:
- Sports cards: ⚾🏈🏀🏒⚽🎾🥊 (use the sport's emoji)
- Graded/condition: 💎🔥✨
- Collectibility/value: 📈🌟💰
- Shipping/protection: 📦🛡️
- Star players: 🏆👑⭐
- Pokemon/gaming cards: 🎮✨🃏

RULES:
- Only state facts you know from the card details — never invent populations, prices, or stories
- If photos are provided, reference 1-2 specific visual details you actually observe
- Keep total length to ~400-600 words
- Always end with the shipping line

OUTPUT — return ONLY this JSON, nothing else:
{"description":"string — full emoji-rich description with section headers and bullet points"}`;

const LOT_DESCRIPTION_SYSTEM = `You are an expert eBay trading card seller writing the description for a LOT of multiple cards (Trading Card Lots category). The buyer is purchasing a bundle, not a single card.

STYLE & TONE:
- Enthusiastic, collector-to-collector voice
- Use emojis liberally for section headers and emphasis
- Bullet points work well for listing what's included
- Short, punchy paragraphs — no walls of text
- Make the value of the bundle clear ("X cards for one price")

STRUCTURE — must include all six sections in this order:
1. Opening hook — what kind of lot this is (rookies, vintage, mixed sport, specific player, etc.), total card count
2. "📦 What's Included" section — REQUIRED. Take every line from the seller's "Cards included in the lot" list and emit it as its own bullet point. Do not summarize, do not collapse multiple cards into one line, do not skip cards. If the seller listed 4 cards, the bullet list must have 4 bullets, one per card, with the seller's exact card text on each. Include the total card count above or below the list.
3. "✨ Why This Lot" section — collector appeal. Specific players/sets that stand out, era significance, what makes this a good pickup
4. "💎 Condition Notes" section — condition info if provided; otherwise say "See photos for condition details"
5. "🔥 Great For" section — 3-4 bullets matching buyer types (PC builders, set builders, flippers, dealers)
6. Closing line: "Ships fast and secure in a bubble mailer with cards in penny sleeves and top loaders or team bags for protection."

RULES:
- Reproduce the seller's card list VERBATIM in the "What's Included" section — one bullet per line they provided
- Do not invent or substitute cards
- If a player or card is mentioned by the seller, you may briefly note their significance in the "Why This Lot" section, but stick to facts
- Total length ~300-500 words
- Always include the total card count
- Always end with the shipping line

OUTPUT — return ONLY this JSON, nothing else:
{"description":"string — full emoji-rich lot description with section headers and bullet points"}`;

// Legacy full system prompt kept for backward compatibility
const LISTING_SYSTEM = QUICK_SYSTEM;

// ─────────────────────────────────────────────────────────────────────────────

type MediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

function mediaTypeFromPath(url: string): MediaType {
  const ext = extname(url).toLowerCase();
  if (ext === ".png")  return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function loadPhotoBase64(url: string): Promise<{ data: string; mediaType: MediaType } | null> {
  try {
    const filePath = join(process.cwd(), "public", url.startsWith("/") ? url.slice(1) : url);
    const data = await readFile(filePath);
    return { data: data.toString("base64"), mediaType: mediaTypeFromPath(url) };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch (e) {
    return NextResponse.json({ error: (e as AdminError).message }, { status: (e as AdminError).status ?? 403 });
  }

  const body = await req.json();
  // phase: "quick" → title + pricing only (fast)
  // phase: "description" → description only (runs in background while user reviews)
  const phase: "quick" | "description" = body.phase ?? "quick";

  const { photos = [], ...card } = body as {
    photos: string[];
    player: string; year?: number | null; manufacturer?: string | null;
    set?: string | null; subset?: string | null; cardNumber?: string | null; sport?: string | null;
    graded: boolean; grade?: string | null; gradeCompany?: string | null; certNumber?: string | null;
    numbered: boolean; serialNumber?: string | null;
    autographed: boolean; signedBy?: string | null;
    autographAuthentication?: string | null; autographFormat?: string | null;
    condition?: string | null; notes?: string | null; askingPrice?: number | null;
    listingType?: string | null; desiredPrice?: number | null;
    allowOffers?: boolean; minimumOffer?: number | null;
    team?: string | null; league?: string | null; season?: string | null;
    parallel?: string | null; features?: string[];
    cardName?: string | null; cardType?: string | null; cardSize?: string | null;
    countryOfOrigin?: string | null; upc?: string | null;
    isLot?: boolean; cardCount?: number | null; lotContents?: string | null;
  };

  const loadedPhotos = (
    await Promise.all(photos.slice(0, 4).map(loadPhotoBase64))
  ).filter((p): p is { data: string; mediaType: MediaType } => p !== null);

  const hasPhotos = loadedPhotos.length > 0;

  // ── Variable card details (not cached — different every call) ──────────────
  const cardSummary = [
    card.year         && `Year: ${card.year}`,
    card.manufacturer && `Manufacturer: ${card.manufacturer}`,
    card.set          && `Set: ${card.set}`,
    card.subset       && `Subset/Variation: ${card.subset}`,
    `Player: ${card.player}`,
    card.cardNumber   && `Card number: #${card.cardNumber}`,
    card.sport        && `Sport: ${card.sport}`,
    card.graded
      ? `Graded: ${card.gradeCompany} ${card.grade}${card.certNumber ? ` (Cert #${card.certNumber})` : ""}`
      : `Raw/Ungraded${card.condition ? ` — ${card.condition}` : ""}`,
    card.numbered && card.serialNumber ? `Numbered: ${card.serialNumber}` : null,
    card.autographed  ? `Autographed: Yes${card.signedBy ? ` (signed by ${card.signedBy})` : ""}${card.autographAuthentication ? `, ${card.autographAuthentication} authenticated` : ""}${card.autographFormat ? `, format: ${card.autographFormat}` : ""}` : null,
    card.condition    ? `Condition: ${card.condition}` : null,
    card.team         ? `Team: ${card.team}` : null,
    card.league       ? `League: ${card.league}` : null,
    card.season       ? `Season: ${card.season}` : null,
    card.parallel     ? `Parallel/Variety: ${card.parallel}` : null,
    card.features?.length ? `Features: ${card.features.join(", ")}` : null,
    card.cardName     ? `Card name: ${card.cardName}` : null,
    card.cardType     ? `Type: ${card.cardType}` : null,
    card.cardSize     ? `Card size: ${card.cardSize}` : null,
    card.countryOfOrigin ? `Country of origin: ${card.countryOfOrigin}` : null,
    card.allowOffers  ? `Seller accepts offers${card.minimumOffer ? ` (minimum: $${card.minimumOffer})` : ""}` : null,
    card.notes        ? `Seller notes: ${card.notes}` : null,
    card.listingType  ? `Seller's preferred listing type: ${card.listingType === "buyitnow" ? "Buy It Now (fixed price)" : "Auction"}` : null,
    card.desiredPrice != null
      ? `Seller's desired ${card.listingType === "buyitnow" ? "Buy It Now price" : "starting bid"}: $${card.desiredPrice}` : null,
    card.askingPrice  ? `Seller asking price: $${card.askingPrice}` : null,
    hasPhotos
      ? `${loadedPhotos.length} card photo(s) are attached — describe specific visual details you observe.`
      : null,
  ].filter(Boolean).join("\n");

  const isLotListing = !!card.isLot && (card.cardCount ?? 0) > 0;
  console.log(`[generate] phase=${phase} isLot=${card.isLot} cardCount=${card.cardCount} lotContentsLen=${card.lotContents?.length ?? 0} → isLotListing=${isLotListing}`);
  const lotSummary = isLotListing
    ? `\n\n========================================\nTHIS IS A LOT LISTING OF ${card.cardCount} CARDS.\n========================================\nThe seller provided the following list of cards included in this lot. Reproduce EVERY line below as its own bullet point in the "What's Included" section — do not summarize or skip any:\n\n${card.lotContents ?? "(seller did not list individual cards — describe based on photos and any details above)"}\n========================================`
    : "";

  const phaseInstruction = phase === "description"
    ? `Write the description for this listing.\nListing title: ${body.title ?? ""}\n\nCard details:\n${cardSummary}${lotSummary}`
    : `Generate title and pricing for ${isLotListing ? `this lot of ${card.cardCount} cards` : "this card"}.\n\nCard details:\n${cardSummary}${lotSummary}`;

  const userText = hasPhotos
    ? `${phaseInstruction}\n\nPhotos are attached above.`
    : phaseInstruction;

  // ── Message content: photos first, then the variable card details ──────────
  const userContent: Anthropic.MessageParam["content"] = [];

  if (hasPhotos) {
    for (const photo of loadedPhotos) {
      userContent.push({
        type:   "image",
        source: { type: "base64", media_type: photo.mediaType, data: photo.data },
      });
    }
  }
  userContent.push({ type: "text", text: userText });

  const { claudeMessage } = await import("@/lib/claude");
  const message = await claudeMessage({
    system:    phase === "description"
                 ? (isLotListing ? LOT_DESCRIPTION_SYSTEM : DESCRIPTION_SYSTEM)
                 : QUICK_SYSTEM,
    userContent,
    // Quick phase: always use Haiku — tiny output, blazing fast
    // Description phase: use Sonnet when photos are present for visual detail
    model:     phase === "description"
      ? (hasPhotos ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001")
      : "claude-haiku-4-5-20251001",
    // Description phase needs more room: 400-600 words + emojis + section headers ≈ 1200-1800 tokens
    maxTokens: phase === "description" ? 2048 : 256,
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    let result: Record<string, unknown>;
    try {
      // Happy path: Claude output well-formed JSON with escaped newlines
      result = JSON.parse(jsonMatch[0]);
    } catch {
      // Fallback: Claude wrote literal newlines inside the string value — sanitize only then
      const sanitized = jsonMatch[0].replace(
        /"description"\s*:\s*"([\s\S]*?)"\s*\}/,
        (_m, body) => `"description":${JSON.stringify(body)}}`
      );
      result = JSON.parse(sanitized);
    }

    if (typeof result.title === "string" && result.title.length > 80) {
      result.title = result.title.slice(0, 80).trim();
    }
    // Claude sometimes writes literal \n (backslash-n) as text markers instead of
    // real newline characters — convert them so line breaks display correctly.
    if (typeof result.description === "string") {
      result.description = result.description.replace(/\\n/g, "\n");
    }
    return NextResponse.json({ ...result, photosUsed: loadedPhotos.length });
  } catch (err) {
    console.error("[generate] parse error:", err, "\nraw:", text.slice(0, 500));
    return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
  }
}
