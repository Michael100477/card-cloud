/**
 * eBay Marketplace Account Deletion / Closure Notification endpoint.
 *
 * Required by eBay to enable production keysets:
 *   developer.ebay.com → your app → "Notification preferences" → register this URL
 *
 * How it works:
 *   1. eBay sends a GET challenge to verify you own the endpoint
 *   2. eBay POSTs a notification whenever an eBay user closes their account
 *   3. We look up the user by their eBay account ID and delete their data
 *
 * Environment variable needed (set in admin → API Keys or .env):
 *   EBAY_DELETION_VERIFICATION_TOKEN — a random string YOU invent and paste into
 *   the eBay Developer Portal when registering this endpoint.
 *   Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

// ─── Challenge verification (GET) ─────────────────────────────────────────────
// eBay hits this URL with ?challenge_code=xxx to confirm you own the endpoint.
// Respond with SHA-256(challenge_code + verification_token + endpoint_url).

export async function GET(req: NextRequest) {
  const challengeCode = req.nextUrl.searchParams.get("challenge_code");
  if (!challengeCode) {
    return NextResponse.json({ error: "Missing challenge_code" }, { status: 400 });
  }

  const verificationToken = process.env.EBAY_DELETION_VERIFICATION_TOKEN;
  if (!verificationToken) {
    console.error("[ebay-deletion] EBAY_DELETION_VERIFICATION_TOKEN not set");
    return NextResponse.json({ error: "Endpoint not configured" }, { status: 500 });
  }

  // Must exactly match the URL you registered in the eBay portal
  // Set EBAY_DELETION_ENDPOINT_URL to the public-facing URL (Cloudflare tunnel, or your domain in production)
  const endpointUrl = process.env.EBAY_DELETION_ENDPOINT_URL
    ?? `${process.env.NEXTAUTH_URL}/api/ebay/marketplace-deletion`;

  const challengeResponse = crypto
    .createHash("sha256")
    .update(challengeCode + verificationToken + endpointUrl)
    .digest("hex");

  console.log(`[ebay-deletion] Challenge verified for code: ${challengeCode.slice(0, 8)}…`);
  return NextResponse.json({ challengeResponse });
}

// ─── Deletion notification (POST) ─────────────────────────────────────────────
// eBay posts a JSON payload when a user closes their eBay account.
// We find the user by their eBay account ID and scrub their data.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Verbose payload logging is off by default — eBay broadcasts these
    // notifications dozens of times an hour and they were drowning out
    // real app logs. Set EBAY_DELETION_VERBOSE=1 to re-enable for debugging.
    if (process.env.EBAY_DELETION_VERBOSE === "1") {
      console.log("[ebay-deletion] Received notification:", JSON.stringify(body).slice(0, 200));
    }

    // eBay notification payload shape:
    // { metadata: { topic, schemaVersion, deprecated },
    //   notification: { notificationId, eventDate, publishDate, publishAttemptCount,
    //                   data: { username, userId, eiasToken } } }
    const data = body?.notification?.data;
    if (!data) {
      // Could be a test ping — acknowledge and move on
      return new NextResponse(null, { status: 200 });
    }

    const { username, userId } = data as { username?: string; userId?: string };

    if (userId || username) {
      // Find users who signed in via eBay OAuth
      // eBay userId is stored in the Account table as providerAccountId
      const accountsToDelete = await db.account.findMany({
        where: {
          provider: "ebay",
          ...(userId ? { providerAccountId: userId } : {}),
        },
        select: { userId: true },
      });

      for (const acct of accountsToDelete) {
        console.log(`[ebay-deletion] Deleting data for user ${acct.userId} (eBay account: ${userId ?? username})`);
        // Delete in the correct cascade order
        await db.card.deleteMany(       { where: { ownerId: acct.userId } });
        await db.collection.deleteMany( { where: { ownerId: acct.userId } });
        await db.feedPost.deleteMany(   { where: { userId:  acct.userId } });
        await db.account.deleteMany(    { where: { userId:  acct.userId } });
        await db.session.deleteMany(    { where: { userId:  acct.userId } });
        await db.user.delete(           { where: { id:      acct.userId } });
      }

      if (accountsToDelete.length > 0) {
        // Always log actual deletions — they're rare and important
        console.log(`[ebay-deletion] Deleted ${accountsToDelete.length} user(s) linked to eBay account ${userId ?? username}`);
      } else if (process.env.EBAY_DELETION_VERBOSE === "1") {
        // No-op notifications happen constantly (eBay broadcasts deletions
        // for users that never signed in here). Only log when explicitly
        // debugging the webhook.
        console.log(`[ebay-deletion] No matching user found for eBay account ${userId ?? username} — nothing to delete`);
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (e) {
    console.error("[ebay-deletion] Error processing notification:", e);
    // Still return 200 so eBay doesn't retry indefinitely
    return new NextResponse(null, { status: 200 });
  }
}
