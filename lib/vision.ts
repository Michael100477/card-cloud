/**
 * Vision-based slab label reading using Claude.
 * Replaces the Tesseract OCR pipeline — Claude reads the label directly
 * from the photo regardless of orientation, lighting, or label design.
 *
 * Cost: ~$0.005-0.01 per scan with claude-sonnet-4-6.
 * The LABEL_PROMPT (~1200 tokens) is cached via the shared claudeMessage()
 * helper — only the image changes per call, so cache hits are essentially
 * guaranteed after the first scan in any 5-minute window.
 */

import sharp from "sharp";
import type { LabelData } from "@/lib/ocr";
import { claudeMessage } from "@/lib/claude";

// ── System prompt (cached) ────────────────────────────────────────────────────
// ~1200 tokens, identical on every scan. Stays in system so it is cached
// automatically by claudeMessage(). The user turn carries only the image.

const LABEL_PROMPT = `This is a photo of a sports or trading card — it may be a graded card inside a protective slab, or a raw (ungraded) card. It MAY also be a photo containing MULTIPLE cards (a lot).

FIRST AND MOST IMPORTANT: count the cards in the photo.
- cardCount: integer count of distinct trading cards visible in the photo. If a single card is shown front and back (two photos of the same card), that's still cardCount=1. If you can see two or more clearly different cards (different players, different designs, or arranged as a group/stack/lot), set cardCount to that number. Cap at 50.
- isLot: true if cardCount >= 2, false otherwise.

If isLot is true, return the JSON with cardCount + isLot set, and leave the per-card identification fields (player, year, manufacturer, set, etc.) as null — the user will fill those in manually for a lot listing. You can still try to identify the SPORT and SET if all cards in the lot appear to be from the same set.

Otherwise (cardCount === 1) proceed with the normal single-card extraction below.

First determine: is this a GRADED card inside a slab, or a RAW (ungraded) card?
- isGraded: true if the card is inside a grading slab (PSA, BGS, SGC, CGC, etc.), false if it is a raw card not in a slab

ALSO determine: is this card AUTOGRAPHED?
- isAutographed: true if you can see a signature on the card itself OR if the card design/label indicates an autograph card (e.g. "AUTO", "Signature", "Autographed Edition", a clearly visible handwritten signature on the card face, a sticker autograph, or a label/serial that includes "AUTO"). false otherwise.

⚠ CRITICAL RULE: For graded cards, extract ONLY information that is LITERALLY PRINTED on the grading label. Do NOT use your knowledge of cards to fill in missing information from the label. If a label field is not printed → return null for that field.

For GRADED cards — look at the GRADING LABEL (the small printed label on the slab, NOT the card artwork) and extract:
- certNumber: the certification/serial number (usually 7-10 digits, e.g. "80239626" or "0013144244")
- grader: the grading company (PSA / BGS / BGGS / BCCG / SGC / CGC / HGA)
- player: the player or card name as printed on the label
- year: the card year as a number — ONLY if printed on the label
- manufacturer: the parent company printed on the label (Topps, Panini, Upper Deck, Fleer, Classic, etc.)
- set: the specific product/set name as printed on the label
- subset: ONLY if a subset/variety is literally printed on the label (e.g. "Refractor", "Artist's Proof") — if not printed on the label, return null
- cardNumber: the card number — usually printed at the bottom or back of a raw card, or on the slab label for graded cards. CAN BE PURELY NUMERIC, PURELY LETTERS, OR A COMBINATION OF BOTH (e.g. "170", "509", "87BJ", "RAD-JG", "RC-25", "Bo-1"). If the user uploads a photo of the back of a raw card, look there carefully — card numbers on raw cards are typically printed near the top or bottom of the back in small text, often prefixed with "#" or "No." Return the value WITHOUT the leading "#"/"No." prefix.
- grade: the numerical overall grade (e.g. "9.5", "8", "10")
- sport: determine using this priority order:
  1. Explicitly printed on the label (e.g. "BASEBALL", "FOOTBALL") → use that
  2. Look at the CARD ARTWORK visible through the slab — a player's uniform, equipment, or setting makes the sport obvious (football pads/helmet = Football, baseball uniform/bat/glove = Baseball, basketball jersey/court = Basketball, hockey gear = Hockey, etc.). This is the most reliable method for multi-sport athletes like Bo Jackson who had both a 1989 Score football card and a 1989 Score baseball card — the uniform on the card settles it immediately
  3. If the player is not in uniform or the artwork is unclear, make your best guess based on player name — but treat this as a low-confidence fallback
  Return one of: "Baseball", "Football", "Basketball", "Hockey", "Soccer", "Golf", "Tennis", "Boxing", "MMA", "Wrestling", "Pokémon", "Magic: The Gathering", "Yu-Gi-Oh!" — or null if truly unable to determine.

- bgsSubCentering: BGS centering subgrade number (e.g. 9, 9.5) — BGS/BGGS only, null for all other graders
- bgsSubCorners: BGS corners subgrade — BGS/BGGS only
- bgsSubEdges: BGS edges subgrade — BGS/BGGS only
- bgsSubSurface: BGS surface subgrade — BGS/BGGS only

IMPORTANT for BGS/BGGS labels:
- The OVERALL grade is the single LARGE number printed alone in the top-right corner of the label (e.g. "9" or "9.5" in big text)
- The CENTERING, CORNERS, EDGES, SURFACE values are SUBGRADES — they are smaller numbers next to those specific labels
- Do NOT use a subgrade value as the overall grade
- Example: if label shows big "9" on the right and "EDGES 9.5 SURFACE 9.5" in smaller text, grade="9", bgsSubEdges=9.5, bgsSubSurface=9.5

Other notes:
- For BGS/BGGS, the Beckett logo may appear as a clear watermark — identify from subgrade labels
- manufacturer and set: Topps makes Bowman Chrome (manufacturer="Topps", set="Bowman Chrome")
  For a plain "1987 TOPPS" label: manufacturer="Topps", set="Topps"
  For "2017 TOPPS" base card: manufacturer="Topps", set="Topps"
  Always populate manufacturer — it is the company name (Topps/Panini/Upper Deck/Fleer/Donruss)
- Return ONLY a JSON object. Use null for fields you cannot read.

Example PSA response:
{"isGraded":true,"certNumber":"80239626","grader":"PSA","player":"Bo Jackson","year":1987,"manufacturer":"Topps","set":"Topps","subset":null,"cardNumber":"170","grade":"8","sport":"Baseball","bgsSubCentering":null,"bgsSubCorners":null,"bgsSubEdges":null,"bgsSubSurface":null,"isAutographed":false}

Example BGS response:
{"isGraded":true,"certNumber":"0013144244","grader":"BGS","player":"Bo Jackson","year":2017,"manufacturer":"Topps","set":"'87 Topps Silver Pack Chrome","subset":null,"cardNumber":"87BJ","grade":"9.5","sport":"Baseball","bgsSubCentering":9,"bgsSubCorners":9.5,"bgsSubEdges":9.5,"bgsSubSurface":9.5}

Example raw card response:
{"isGraded":false,"certNumber":null,"grader":"Unknown","player":"Bo Jackson","year":1987,"manufacturer":"Topps","set":"Topps","subset":null,"cardNumber":"170","grade":null,"sport":"Baseball","bgsSubCentering":null,"bgsSubCorners":null,"bgsSubEdges":null,"bgsSubSurface":null,"isAutographed":false}`;

// ── Image resizing ────────────────────────────────────────────────────────────

async function resizeForVision(imageBuffer: Buffer): Promise<{ data: string; mediaType: "image/jpeg" }> {
  const resized = await sharp(imageBuffer)
    .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return { data: resized.toString("base64"), mediaType: "image/jpeg" };
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface VisionResult {
  cardCount?:      number;       // 1 for a single card, 2+ for a lot
  isLot?:          boolean;      // true when cardCount >= 2
  isGraded:        boolean;
  certNumber:      string | null;
  grader:          string;
  player:          string | null;
  year:            number | null;
  manufacturer:    string | null;
  set:             string | null;
  subset:          string | null;
  cardNumber:      string | null;
  grade:           string | null;
  sport:           string | null;
  bgsSubCentering: number | null;
  bgsSubCorners:   number | null;
  bgsSubEdges:     number | null;
  bgsSubSurface:   number | null;
  isAutographed:   boolean;
}

export async function readLabelWithVision(imageBuffer: Buffer): Promise<VisionResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const image = await resizeForVision(imageBuffer);

    // LABEL_PROMPT is in system (cached). Only the image varies per call.
    const response = await claudeMessage({
      system:      LABEL_PROMPT,
      userContent: [{ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } }],
      model:       "claude-sonnet-4-6",
      maxTokens:   500,
    });

    const text = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      isGraded:        parsed.isGraded === true || !!(parsed.certNumber && parsed.grader && parsed.grader !== "Unknown"),
      certNumber:      parsed.certNumber   ? String(parsed.certNumber).replace(/\D/g, "") : null,
      grader:          parsed.grader       ?? "Unknown",
      player:          parsed.player       ?? null,
      year:            parsed.year         ? parseInt(String(parsed.year)) : null,
      manufacturer:    parsed.manufacturer ?? null,
      set:             parsed.set          ?? null,
      subset:          parsed.subset       ?? null,
      cardNumber:      parsed.cardNumber   ? String(parsed.cardNumber) : null,
      grade:           parsed.grade        ? String(parsed.grade) : null,
      sport:           parsed.sport        ?? null,
      bgsSubCentering: parsed.bgsSubCentering != null ? parseFloat(parsed.bgsSubCentering) : null,
      bgsSubCorners:   parsed.bgsSubCorners   != null ? parseFloat(parsed.bgsSubCorners)   : null,
      bgsSubEdges:     parsed.bgsSubEdges     != null ? parseFloat(parsed.bgsSubEdges)     : null,
      bgsSubSurface:   parsed.bgsSubSurface   != null ? parseFloat(parsed.bgsSubSurface)   : null,
      isAutographed:   parsed.isAutographed === true,
    };
  } catch (err) {
    console.error("[vision]", err);
    return null;
  }
}
