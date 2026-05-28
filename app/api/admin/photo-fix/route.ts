import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { anthropic } from "@/lib/claude";
import { db } from "@/lib/db";

const JPEG_QUALITY   = 92;
const SLAB_WIDTH_IN  = 3.2;
const SLAB_HEIGHT_IN = 4.35;
const CARD_WIDTH_IN  = 2.5;
const CARD_HEIGHT_IN = 3.5;
const CROP_HALF_W_IN = 2.0;
const CROP_HALF_H_IN = 2.5;

// ─── Glare removal ───────────────────────────────────────────────────────────
// Flash glare appears as overexposed, nearly-white regions with very low colour
// saturation.  We detect those pixels, then replace them with values from a
// heavily-blurred version of the image — which fills the blown-out area with
// the surrounding card colours.  A soft blend (proportional to how blown-out
// each pixel is) keeps the transition smooth and avoids hard edges.

async function removeGlare(inputBuf: Buffer): Promise<{ buffer: Buffer; removed: boolean }> {
  // Quick glare check on a tiny thumbnail — avoids full processing when unnecessary
  const thumb      = await sharp(inputBuf).resize(400, undefined, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const tPix       = thumb.data as unknown as Uint8Array;
  const tTotal     = thumb.info.width * thumb.info.height;
  const tCh        = thumb.info.channels;
  let   glarePx    = 0;

  for (let i = 0; i < tTotal; i++) {
    const p = i * tCh;
    const r = tPix[p], g = tPix[p+1], b = tPix[p+2];
    const brightness = (r + g + b) / 3;
    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
    const sat  = maxC > 0 ? (maxC - minC) / maxC : 0;
    if (brightness > 240 && sat < 0.10) glarePx++;
  }

  // Skip if less than 0.15% of thumbnail pixels look like glare
  // (0.15% × 120k thumbnail pixels ≈ 180 px = ~45×45px glare in the original)
  if (glarePx / tTotal < 0.0015) return { buffer: inputBuf, removed: false };

  // ── Apply glare removal on full-resolution image ─────────────────────────

  // The large blur "fills in" the overexposed region using surrounding pixels
  const blurSigma  = 30;   // covers glare spots up to ~200px wide
  const blurredBuf = await sharp(inputBuf).blur(blurSigma).toBuffer();

  const [origRaw, blurRaw] = await Promise.all([
    sharp(inputBuf)  .raw().toBuffer({ resolveWithObject: true }),
    sharp(blurredBuf).raw().toBuffer({ resolveWithObject: true }),
  ]);

  const oP  = origRaw.data as unknown as Uint8Array;
  const bP  = blurRaw.data as unknown as Uint8Array;
  const { width, height, channels } = origRaw.info;
  const out = Buffer.from(oP);   // start with copy of original

  const THRESH_HI  = 245;   // pixel is definitely glare above this brightness
  const THRESH_LO  = 225;   // start blending from here
  const SAT_THRESH = 0.15;  // must be desaturated (white-ish) to count as glare

  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    const r = oP[p], g = oP[p+1], b = oP[p+2];
    const brightness = (r + g + b) / 3;
    if (brightness <= THRESH_LO) continue;   // fast skip for clearly normal pixels

    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
    const sat  = maxC > 0 ? (maxC - minC) / maxC : 0;
    if (sat >= SAT_THRESH) continue;          // coloured pixels are not glare

    // Blend factor: 0 at THRESH_LO → 1 at THRESH_HI, scaled by how desaturated
    const brightFactor = Math.min(1, (brightness - THRESH_LO) / (THRESH_HI - THRESH_LO));
    const satFactor    = 1 - sat / SAT_THRESH;
    const blend        = brightFactor * satFactor;

    out[p]   = Math.round(r         * (1 - blend) + bP[p]   * blend);
    out[p+1] = Math.round(g         * (1 - blend) + bP[p+1] * blend);
    out[p+2] = Math.round(b         * (1 - blend) + bP[p+2] * blend);
  }

  // Apply a very small blur to smooth the repair boundary
  const result = await sharp(out, { raw: { width, height, channels: channels as 3 | 4 } })
    .blur(1.2)
    .jpeg({ quality: 92 })
    .toBuffer();

  return { buffer: result, removed: true };
}

// ─── Few-shot training examples ───────────────────────────────────────────────

interface TrainingExample {
  beforeThumb: string;
  afterThumb:  string;
  cx:          number;
  cy:          number;
  category:    string;
  description: string;
  sourcePath:  string;
}

async function loadFewShotExamples(): Promise<TrainingExample[]> {
  try {
    // Grab a diverse mix: up to 3 graded + 1 raw, newest first
    const graded = await db.photoTrainingSample.findMany({
      where:   { category: { startsWith: "graded" } },
      orderBy: { createdAt: "desc" },
      take:    3,
      select:  { beforeThumb: true, afterThumb: true, cx: true, cy: true, category: true, description: true, sourcePath: true },
    });
    const raw = await db.photoTrainingSample.findMany({
      where:   { category: { startsWith: "raw" } },
      orderBy: { createdAt: "desc" },
      take:    1,
      select:  { beforeThumb: true, afterThumb: true, cx: true, cy: true, category: true, description: true, sourcePath: true },
    });
    return [...graded, ...raw];
  } catch { return []; }
}

// ─── Rejection guidance ───────────────────────────────────────────────────────

const REJECTION_GUIDANCE: Record<string, string> = {
  "Multiple cards":      "Please photograph one card at a time against a plain background.",
  "Card obscured":       "Make sure the entire card is visible with nothing covering it.",
  "Too far away":        "Move the camera closer so the card fills more of the frame.",
  "Steep angle":         "Hold the camera directly above the card, looking straight down.",
  "Blurry":              "Hold the camera steady and make sure there is enough light.",
  "Glare covering card": "Reposition your light source or tilt the camera slightly to avoid reflections.",
  "Wrong subject":       "This doesn't appear to be a sports or trading card.",
  "Already cropped":     "This photo is already properly cropped — no adjustment needed.",
};

// ─── Pass 1: rough location ───────────────────────────────────────────────────

const PASS1_PROMPT = `Where is the trading card or graded slab in this photo?
Give its CENTER position as a percentage of the image width (0=left, 100=right) and image height (0=top, 100=bottom).
Say whether it is graded (PSA/BGS/SGC/CGC thick plastic slab) or ungraded (bare card / thin sleeve).
Also say if the card is UPSIDE DOWN — i.e. the grading label appears at the BOTTOM or the card back is facing up.

If the photo CANNOT be processed, return a rejected type with one of these exact reasons:
- "Multiple cards" — more than one card is visible
- "Card obscured" — something is covering part of the card
- "Too far away" — the card is too small in the frame to process accurately
- "Steep angle" — camera angle is too steep for reliable straightening
- "Blurry" — photo is out of focus
- "Glare covering card" — glare or reflections obscure key areas of the card
- "Wrong subject" — this is not a sports or trading card
- "Already cropped" — the photo is already a clean crop with no background to remove

Return ONLY JSON:
{ "type": "graded", "grader": "PSA", "cx": 45, "cy": 38, "flipped": false }
or { "type": "ungraded", "cx": 45, "cy": 38, "flipped": false }
or { "type": "rejected", "reason": "Blurry" }
or { "type": "none" }`;

interface Pass1 { type: "graded" | "ungraded" | "none" | "rejected"; grader?: string; cx?: number; cy?: number; flipped?: boolean; reason?: string }

async function roughLocation(buf: Buffer, examples: Awaited<ReturnType<typeof loadFewShotExamples>>): Promise<Pass1> {
  try {
    type CB = { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } } | { type: "text"; text: string };
    const content: CB[] = [];
    if (examples.length > 0) {
      content.push({ type: "text", text: `Here are ${examples.length} real training examples — original photo and correctly cropped result. Use these as visual references:\n` });
      for (const ex of examples) {
        const bBefore  = ex.beforeThumb.replace(/^data:image\/\w+;base64,/, "");
        const bAfter   = ex.afterThumb.replace(/^data:image\/\w+;base64,/, "");
        // Parse "category/face/card_name" from sourcePath
        const parts    = (ex.sourcePath ?? "").split("/");
        const face     = parts.length >= 3 ? parts[1] : "";
        const cardName = parts.length >= 3 ? parts[2] : (parts[1] ?? ex.category);
        const isReject = ex.category === "rejects";
        const faceLabel = face ? ` · ${face}` : "";
        const label     = isReject ? "REJECT EXAMPLE" : "Example";

        // Parse descriptor fields and diagnosis from description
        const descLines  = (ex.description ?? "").split("\n").map((l: string) => l.trim()).filter(Boolean);
        const diagLine   = descLines.find((l: string) => l.startsWith("Accepted:") || l.startsWith("Rejected:")) ?? "";
        const propLines  = descLines.filter((l: string) => !l.startsWith("Accepted:") && !l.startsWith("Rejected:"));

        content.push({ type: "text", text: `\n${label} — ${ex.category.replace(/_/g, " ")}${faceLabel}: ${cardName}\n` });
        if (propLines.length > 0) {
          content.push({ type: "text", text: `Photo conditions: ${propLines.join(" | ")}\n` });
        }
        content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: bBefore } });
        if (!isReject) {
          content.push({ type: "text", text: `→ correctly cropped to:\n` });
          content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: bAfter } });
          content.push({ type: "text", text: `Card center: ${Math.round(ex.cx * 100)}% from left, ${Math.round(ex.cy * 100)}% from top. ${diagLine}\n` });
        } else {
          content.push({ type: "text", text: `→ this photo CANNOT be cropped. ${diagLine} — return the original untouched.\n` });
        }
      }
      content.push({ type: "text", text: `\nNow process this new photo:\n` });
    }
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") } });
    content.push({ type: "text", text: PASS1_PROMPT });
    const res = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 80, messages: [{ role: "user", content }] });
    const tb = res.content.find(b => b.type === "text");
    if (!tb || tb.type !== "text") return { type: "none" };
    const m = tb.text.match(/\{[\s\S]*?\}/);
    return m ? JSON.parse(m[0]) as Pass1 : { type: "none" };
  } catch { return { type: "none" }; }
}

// ─── Pass 2: four-corner detection ───────────────────────────────────────────
// Asking for all 4 corners lets us detect perspective distortion (trapezoid
// shape) in addition to simple rotation, enabling a full homography warp.

const PASS2_PROMPT = `This is a close-up of a trading card or graded slab.

Find the EXACT four corners of the slab or card — the outermost corners of the
plastic case (graded) or card edges (ungraded).

IMPORTANT: If the photo was taken at an angle, the card will appear as a
trapezoid (top and bottom have different widths). Give the true corners of that
trapezoid — do NOT assume the top and bottom are the same width.

Return ONLY JSON:
{
  "topLeft":  {"x": 120, "y":  45},
  "topRight": {"x": 490, "y":  38},
  "botRight": {"x": 502, "y": 625},
  "botLeft":  {"x": 108, "y": 630},
  "tiltDeg": 1.5
}

tiltDeg = degrees the card is rotated in the 2D plane (0 = upright, ignoring perspective).`;

interface Corners {
  topLeft:  { x: number; y: number };
  topRight: { x: number; y: number };
  botRight: { x: number; y: number };
  botLeft:  { x: number; y: number };
  tiltDeg:  number;
}

async function detectCorners(buf: Buffer): Promise<Corners | null> {
  try {
    const res = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") } },
          { type: "text",  text: PASS2_PROMPT },
        ],
      }],
    });
    const tb = res.content.find(b => b.type === "text");
    if (!tb || tb.type !== "text") return null;
    const m = tb.text.match(/\{[\s\S]*?\}/);
    return m ? JSON.parse(m[0]) as Corners : null;
  } catch { return null; }
}

// ─── Perspective warp (homography) ────────────────────────────────────────────
// Implements the Direct Linear Transform algorithm to compute a 3×3 homography
// matrix from 4 source corners → 4 destination corners, then applies an
// inverse-mapped warp with bilinear interpolation.
// This correctly handles photos taken at an angle where the card is a trapezoid.

type Pt = [number, number];

function solveLinear8(A: number[][], b: number[]): number[] {
  // Gaussian elimination with partial pivoting — solves 8×8 system Ax = b
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return x;
}

function computeHomography(src: Pt[], dst: Pt[]): number[] {
  // DLT: find H (3×3) such that dst_i ≈ H · src_i (homogeneous).
  // Set h8=1 → solve 8×8 system for h0..h7.
  const rows: number[][] = [], rhs: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    rows.push([-x, -y, -1,  0,   0,   0,  u*x, u*y]); rhs.push(-u);
    rows.push([ 0,  0,  0, -x,  -y,  -1,  v*x, v*y]); rhs.push(-v);
  }
  const h = solveLinear8(rows, rhs);
  return [...h, 1];  // h0..h7 solved, h8=1
}

function invertH(H: number[]): number[] {
  // 3×3 matrix inverse via cofactors
  const [a,b,c,d,e,f,g,hh,i] = H;
  const det = a*(e*i-f*hh) - b*(d*i-f*g) + c*(d*hh-e*g);
  if (Math.abs(det) < 1e-12) return H; // fallback
  const inv = [
     (e*i-f*hh)/det, -(b*i-c*hh)/det,  (b*f-c*e)/det,
    -(d*i-f*g)/det,   (a*i-c*g)/det,  -(a*f-c*d)/det,
     (d*hh-e*g)/det, -(a*hh-b*g)/det,  (a*e-b*d)/det,
  ];
  return inv;
}

async function perspectiveWarp(
  srcBuf: Buffer,
  srcCorners: Pt[],          // [TL, TR, BR, BL] in source image
  dstW: number, dstH: number // output rectangle dimensions
): Promise<Buffer> {
  // Work at a reasonable resolution for speed
  const WARP_MAX = 1200;
  const srcMeta  = await sharp(srcBuf).metadata();
  const srcW0    = srcMeta.width!, srcH0 = srcMeta.height!;
  const warpScale = Math.min(1, WARP_MAX / Math.max(srcW0, srcH0));
  const srcW = Math.round(srcW0 * warpScale), srcH = Math.round(srcH0 * warpScale);

  const scaledBuf = await sharp(srcBuf)
    .resize(srcW, srcH, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pix = scaledBuf.data as unknown as Uint8Array;
  const ch  = scaledBuf.info.channels;

  // Scale corners to warp resolution
  const sc: Pt[] = srcCorners.map(([x, y]) => [x * warpScale, y * warpScale]);

  // Destination corners = perfect rectangle (0,0)→(dstW,0)→(dstW,dstH)→(0,dstH)
  const dstCorners: Pt[] = [[0,0],[dstW,0],[dstW,dstH],[0,dstH]];

  // H maps dst → src (for inverse mapping)
  const H    = computeHomography(dstCorners, sc);
  const Hinv = invertH(H);  // already dst→src, so this is the forward H; we need inv for correctness
  // Actually: H maps dstCorners → srcCorners (forward), so we use H directly for inverse mapping
  // (for each output pixel, apply H to get source pixel)

  const output = Buffer.alloc(dstW * dstH * ch);

  for (let oy = 0; oy < dstH; oy++) {
    for (let ox = 0; ox < dstW; ox++) {
      // Apply H to map output (ox,oy) → input (sx,sy)
      const [h0,h1,h2,h3,h4,h5,h6,h7,h8] = H;
      const w = h6*ox + h7*oy + h8;
      const sx = (h0*ox + h1*oy + h2) / w;
      const sy = (h3*ox + h4*oy + h5) / w;

      if (sx < 0 || sx >= srcW-1 || sy < 0 || sy >= srcH-1) {
        // Outside source — fill with light grey border
        const oi = (oy * dstW + ox) * ch;
        for (let c = 0; c < ch; c++) output[oi+c] = 200;
        continue;
      }

      // Bilinear interpolation
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = x0+1, y1 = y0+1;
      const dx = sx - x0, dy = sy - y0;
      const oi = (oy * dstW + ox) * ch;

      for (let c = 0; c < ch; c++) {
        const v00 = pix[(y0*srcW+x0)*ch+c];
        const v10 = pix[(y0*srcW+x1)*ch+c];
        const v01 = pix[(y1*srcW+x0)*ch+c];
        const v11 = pix[(y1*srcW+x1)*ch+c];
        output[oi+c] = Math.round(v00*(1-dx)*(1-dy) + v10*dx*(1-dy) + v01*(1-dx)*dy + v11*dx*dy);
      }
    }
  }

  return sharp(output, { raw: { width: dstW, height: dstH, channels: ch as 3 | 4 } })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

// ─── Main processing pipeline ─────────────────────────────────────────────────

async function processImage(inputBuffer: Buffer): Promise<{ buffer?: Buffer; info: string; rejected?: boolean; reason?: string; guidance?: string }> {

  // 0a. Auto-apply EXIF orientation
  const oriented = await sharp(inputBuffer).rotate().toBuffer();

  // 0b. Remove flash glare before any geometric processing
  const { buffer: deglared, removed: glareRemoved } = await removeGlare(oriented);

  const meta  = await sharp(deglared).metadata();
  const origW = meta.width!;
  const origH = meta.height!;

  // Pass 1 — rough location
  const [p1Buf, examples] = await Promise.all([
    sharp(deglared).resize(400, undefined, { fit: "inside" }).jpeg({ quality: 80 }).toBuffer(),
    loadFewShotExamples(),
  ]);
  const rough = await roughLocation(p1Buf, examples);

  if (rough.type === "rejected") {
    const reason   = rough.reason ?? "Cannot process";
    const guidance = REJECTION_GUIDANCE[reason] ?? "Please retake the photo and try again.";
    return { info: `Rejected: ${reason}`, rejected: true, reason, guidance };
  }

  if (rough.type === "none" || rough.cx == null || rough.cy == null) {
    return { buffer: await sharp(deglared).jpeg({ quality: JPEG_QUALITY }).toBuffer(), info: "No card detected." };
  }

  // Pass 2 — zoomed 4-corner detection
  const zoomW  = Math.round(origW * 0.70);
  const zoomH  = Math.round(origH * 0.90);
  const zoomX  = Math.max(0, Math.min(origW - zoomW, Math.round(origW * rough.cx / 100 - zoomW / 2)));
  const zoomY  = Math.max(0, Math.min(origH - zoomH, Math.round(origH * rough.cy / 100 - zoomH / 2)));

  const p2Scale = Math.min(1, 900 / zoomW);
  const p2W     = Math.round(zoomW * p2Scale);
  const p2H     = Math.round(zoomH * p2Scale);

  const p2Buf = await sharp(deglared)
    .extract({ left: zoomX, top: zoomY, width: zoomW, height: zoomH })
    .resize(p2W, p2H, { fit: "fill" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const corners = await detectCorners(p2Buf);

  if (!corners) {
    return { buffer: await sharp(deglared).jpeg({ quality: JPEG_QUALITY }).toBuffer(), info: "Could not locate card corners." };
  }

  // Scale corners from zoomed-image → full-resolution coordinates
  const scale = (p: { x: number; y: number }) => ({
    x: zoomX + p.x / p2Scale,
    y: zoomY + p.y / p2Scale,
  });
  const TL = scale(corners.topLeft);
  const TR = scale(corners.topRight);
  const BR = scale(corners.botRight);
  const BL = scale(corners.botLeft);

  const typeLabel = rough.type === "graded" ? `${rough.grader ?? "graded"} slab` : "raw card";
  const physRatio = rough.type === "graded" ? SLAB_HEIGHT_IN / SLAB_WIDTH_IN : CARD_HEIGHT_IN / CARD_WIDTH_IN;

  // Determine if perspective correction is needed
  // Compare top width vs bottom width — if they differ by >8% it's a perspective shot
  const topW  = Math.hypot(TR.x - TL.x, TR.y - TL.y);
  const botW  = Math.hypot(BR.x - BL.x, BR.y - BL.y);
  const avgW  = (topW + botW) / 2;
  const skew  = Math.abs(topW - botW) / Math.max(topW, botW);
  const needsPerspective = skew > 0.08;

  if (needsPerspective) {
    // ── Perspective correction path ─────────────────────────────────────────
    // Warp the 4-corner trapezoid into a perfect rectangle, then add border.
    const dstW = Math.round(avgW);
    const dstH = Math.round(avgW * physRatio);

    if (dstW < 20 || dstH < 20) {
      return { buffer: await sharp(oriented).jpeg({ quality: JPEG_QUALITY }).toBuffer(), info: "Card too small to warp." };
    }

    const srcCorners: [number, number][] = [
      [TL.x, TL.y], [TR.x, TR.y], [BR.x, BR.y], [BL.x, BL.y],
    ];

    // Add BORDER_PCT padding: expand destination rectangle
    const BORDER = 0.07;
    const padW = Math.round(dstW * BORDER), padH = Math.round(dstH * BORDER);
    const outW = dstW + padW * 2, outH = dstH + padH * 2;

    // Shift destination so the card sits in the padded rectangle
    const dstCorners: [number, number][] = [
      [padW, padH], [padW + dstW, padH], [padW + dstW, padH + dstH], [padW, padH + dstH],
    ];
    const H = computeHomography(dstCorners, srcCorners);

    // Generate the warped + padded output directly
    const srcMeta  = await sharp(deglared).metadata();
    const srcW0 = srcMeta.width!, srcH0 = srcMeta.height!;
    const WARP_MAX = 1200;
    const ws = Math.min(1, WARP_MAX / Math.max(srcW0, srcH0));
    const srcW = Math.round(srcW0 * ws), srcH = Math.round(srcH0 * ws);

    const rawSrc = await sharp(deglared)
      .resize(srcW, srcH, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pix = rawSrc.data as unknown as Uint8Array;
    const ch  = rawSrc.info.channels;

    // Scale srcCorners to warp resolution
    const scSrc: [number,number][] = srcCorners.map(([x,y]) => [x * ws, y * ws]);
    const Hw = computeHomography(dstCorners, scSrc);

    const output = Buffer.alloc(outW * outH * ch);
    for (let oy = 0; oy < outH; oy++) {
      for (let ox = 0; ox < outW; ox++) {
        const [h0,h1,h2,h3,h4,h5,h6,h7,h8] = Hw;
        const w  = h6*ox + h7*oy + h8;
        const sx = (h0*ox + h1*oy + h2) / w;
        const sy = (h3*ox + h4*oy + h5) / w;
        const oi = (oy * outW + ox) * ch;
        if (sx < 0 || sx >= srcW-1 || sy < 0 || sy >= srcH-1) {
          for (let c = 0; c < ch; c++) output[oi+c] = 200; continue;
        }
        const x0 = Math.floor(sx), y0 = Math.floor(sy);
        const dx = sx - x0, dy = sy - y0;
        for (let c = 0; c < ch; c++) {
          const v00 = pix[(y0*srcW+x0)*ch+c], v10 = pix[(y0*srcW+(x0+1))*ch+c];
          const v01 = pix[((y0+1)*srcW+x0)*ch+c], v11 = pix[((y0+1)*srcW+(x0+1))*ch+c];
          output[oi+c] = Math.round(v00*(1-dx)*(1-dy)+v10*dx*(1-dy)+v01*(1-dx)*dy+v11*dx*dy);
        }
      }
    }

    const warped = await sharp(output, { raw: { width: outW, height: outH, channels: ch as 3|4 } })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    const glareNote = glareRemoved ? ", glare removed" : "";
    const flipNote  = rough.flipped ? ", flipped right-side up" : "";
    if (!rough.flipped) {
      return { buffer: warped, info: `${typeLabel} — perspective corrected (${(skew*100).toFixed(0)}% skew${glareNote}).` };
    }
    // Flip 180° if upside-down
    const flipped = await sharp(warped).rotate(180).toBuffer();
    return { buffer: flipped, info: `${typeLabel} — perspective corrected${flipNote}.` };

  } else {
    // ── Simple rotation + crop path (existing logic) ─────────────────────────
    const fullCX = (TL.x + TR.x + BR.x + BL.x) / 4;
    const fullCY = (TL.y + TR.y + BR.y + BL.y) / 4;
    const physW  = rough.type === "graded" ? SLAB_WIDTH_IN : CARD_WIDTH_IN;
    const ppi    = avgW / physW;

    const halfW  = Math.round(CROP_HALF_W_IN * ppi);
    const halfH  = Math.round(CROP_HALF_H_IN * ppi);
    const left   = Math.max(0,     Math.round(fullCX - halfW));
    const top    = Math.max(0,     Math.round(fullCY - halfH));
    const right  = Math.min(origW, Math.round(fullCX + halfW));
    const bottom = Math.min(origH, Math.round(fullCY + halfH));

    if (right - left < 20 || bottom - top < 20) {
      return { buffer: await sharp(deglared).jpeg({ quality: JPEG_QUALITY }).toBuffer(), info: "Crop region too small." };
    }

    const cropped = await sharp(deglared)
      .extract({ left, top, width: right - left, height: bottom - top })
      .toBuffer();

    const tilt    = corners.tiltDeg ?? 0;
    const effRot  = rough.flipped ? (-tilt + 180) : -tilt;
    const notes   = [
      Math.abs(tilt) >= 0.5 ? `${Math.abs(tilt).toFixed(1)}° corrected` : "",
      rough.flipped ? "flipped right-side up" : "",
    ].filter(Boolean);

    if (Math.abs(effRot) < 0.5) {
      const out = await sharp(cropped).jpeg({ quality: JPEG_QUALITY }).toBuffer();
      return { buffer: out, info: `${typeLabel} — cropped${notes.length ? ` (${notes.join(", ")})` : ""}.` };
    }

    const rotated = await sharp(cropped).rotate(effRot, { background: { r: 200, g: 200, b: 200, alpha: 1 } }).toBuffer();
    const rMeta   = await sharp(rotated).metadata();
    const rW = rMeta.width!, rH = rMeta.height!;
    const cW = right - left, cH = bottom - top;
    const rL = Math.max(0, Math.round((rW - cW) / 2));
    const rT = Math.max(0, Math.round((rH - cH) / 2));
    const out = await sharp(rotated)
      .extract({ left: rL, top: rT, width: Math.min(rW-rL, cW), height: Math.min(rH-rT, cH) })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    if (glareRemoved) notes.push("glare removed");
    return { buffer: out, info: `${typeLabel} — ${notes.length ? notes.join(", ") : "cropped"}.` };
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const form  = await req.formData();
    const files = form.getAll("files") as File[];
    if (!files.length)     return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    if (files.length > 10) return NextResponse.json({ error: "Max 10 images at once" }, { status: 400 });

    const results = await Promise.all(files.map(async (file) => {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const { buffer: out, info, rejected, reason, guidance } = await processImage(buffer);
        return {
          name:     file.name,
          original: `data:image/jpeg;base64,${buffer.toString("base64")}`,
          result:   out ? `data:image/jpeg;base64,${out.toString("base64")}` : undefined,
          info,
          rejected,
          reason,
          guidance,
          ok: true,
        };
      } catch (e) {
        console.error("[photo-fix] error:", e);
        return { name: file.name, ok: false, error: String(e) };
      }
    }));

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
