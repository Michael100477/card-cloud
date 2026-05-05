/**
 * Vision-based slab label reading using Claude.
 * Replaces the Tesseract OCR pipeline — Claude reads the label directly
 * from the photo regardless of orientation, lighting, or label design.
 *
 * Cost: ~$0.005-0.01 per scan with claude-sonnet-4-6.
 * Falls back to Tesseract OCR if ANTHROPIC_API_KEY is not set.
 */

import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import type { LabelData } from "@/lib/ocr";

const PROMPT = `This is a photo of a graded sports or trading card inside a protective slab.

⚠ CRITICAL RULE: Extract ONLY information that is LITERALLY PRINTED on the grading label.
Do NOT use your knowledge of cards to fill in missing information.
Do NOT infer, guess, or assume any field from the player name or card identity.
If a field is not printed on the label → return null for that field.

Look at the GRADING LABEL — the small printed label on the slab (NOT the card artwork itself). Extract these fields from the label text only:

- certNumber: the certification/serial number (usually 7-10 digits, e.g. "80239626" or "0013144244")
- grader: the grading company (PSA / BGS / BGGS / BCCG / SGC / CGC / HGA)
- player: the player or card name as printed on the label
- year: the card year as a number — ONLY if printed on the label
- manufacturer: the parent company printed on the label (Topps, Panini, Upper Deck, Fleer, Classic, etc.)
- set: the specific product/set name as printed on the label
- subset: ONLY if a subset/variety is literally printed on the label (e.g. "Refractor", "Artist's Proof") — if not printed on the label, return null
- cardNumber: the card number from the label (e.g. "170", "509", "87BJ")
- grade: the numerical overall grade (e.g. "9.5", "8", "10")

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

Example PSA response (label shows "1987 TOPPS / BO JACKSON / #170 / NM-MT 8 / 80239626", no subset printed):
{"certNumber":"80239626","grader":"PSA","player":"Bo Jackson","year":1987,"manufacturer":"Topps","set":"Topps","subset":null,"cardNumber":"170","grade":"8","bgsSubCentering":null,"bgsSubCorners":null,"bgsSubEdges":null,"bgsSubSurface":null}

Example PSA response with subset (label shows "FUTURE STARS" printed on it):
{"certNumber":"80239626","grader":"PSA","player":"Bo Jackson","year":1987,"manufacturer":"Topps","set":"Topps","subset":"Future Stars","cardNumber":"170","grade":"8","bgsSubCentering":null,"bgsSubCorners":null,"bgsSubEdges":null,"bgsSubSurface":null}

Example BGS response:
{"certNumber":"0013144244","grader":"BGS","player":"Bo Jackson","year":2017,"manufacturer":"Topps","set":"'87 Topps Silver Pack Chrome","subset":null,"cardNumber":"87BJ","grade":"9.5","bgsSubCentering":9,"bgsSubCorners":9.5,"bgsSubEdges":9.5,"bgsSubSurface":9.5}`;

async function resizeForVision(imageBuffer: Buffer): Promise<{ data: string; mediaType: "image/jpeg" | "image/png" }> {
  // Resize to max 1568px (Anthropic's recommended max for vision) and convert to JPEG
  const resized = await sharp(imageBuffer)
    .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return {
    data:      resized.toString("base64"),
    mediaType: "image/jpeg",
  };
}

export interface VisionResult {
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
}

export async function readLabelWithVision(imageBuffer: Buffer): Promise<VisionResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const image  = await resizeForVision(imageBuffer);

    const response = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          {
            type:   "image",
            source: { type: "base64", media_type: image.mediaType, data: image.data },
          },
          { type: "text", text: PROMPT },
        ],
      }],
    });

    const text = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");

    // Extract JSON from the response (Claude sometimes wraps it in markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      certNumber:   parsed.certNumber   ? String(parsed.certNumber).replace(/\D/g, "") : null,
      grader:       parsed.grader       ?? "Unknown",
      player:       parsed.player       ?? null,
      year:         parsed.year         ? parseInt(String(parsed.year)) : null,
      manufacturer: parsed.manufacturer ?? null,
      set:          parsed.set          ?? null,
      subset:       parsed.subset       ?? null,
      cardNumber:   parsed.cardNumber   ? String(parsed.cardNumber) : null,
      grade:           parsed.grade        ? String(parsed.grade) : null,
      sport:           parsed.sport        ?? null,
      bgsSubCentering: parsed.bgsSubCentering != null ? parseFloat(parsed.bgsSubCentering) : null,
      bgsSubCorners:   parsed.bgsSubCorners   != null ? parseFloat(parsed.bgsSubCorners)   : null,
      bgsSubEdges:     parsed.bgsSubEdges     != null ? parseFloat(parsed.bgsSubEdges)     : null,
      bgsSubSurface:   parsed.bgsSubSurface   != null ? parseFloat(parsed.bgsSubSurface)   : null,
    };
  } catch (err) {
    console.error("[vision]", err);
    return null;
  }
}
