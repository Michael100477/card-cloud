// Instrumentation — runs once per worker process at startup.
// Used to register the background eBay sync (every 5 minutes) so the
// Shipping page reflects the latest fulfillment state even when no one is
// browsing the admin UI.

let syncIntervalRegistered = false;

export async function register() {
  // Next.js runs instrumentation in both Node.js and Edge runtimes; the
  // background timer only makes sense on the long-running Node server.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Skip during `next build` — the build process also imports this file but
  // we don't want to fire syncs against eBay during compilation.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (syncIntervalRegistered) return;
  syncIntervalRegistered = true;

  const { syncOrdersThrottled } = await import("./lib/ebay-sync-cache");

  console.log("[bg-sync] registering eBay sync — every 5 minutes");

  // Run once immediately on startup so a fresh deploy doesn't have to wait
  // 5 minutes for the first sync to fire.
  setTimeout(() => {
    syncOrdersThrottled({ forceFresh: true })
      .then(() => console.log("[bg-sync] initial sync complete"))
      .catch(e => console.error("[bg-sync] initial sync failed:", e));
  }, 10_000);

  // Recurring every 5 minutes.
  setInterval(() => {
    syncOrdersThrottled({ forceFresh: true })
      .then(() => console.log(`[bg-sync] sync complete at ${new Date().toISOString()}`))
      .catch(e => console.error("[bg-sync] sync failed:", e));
  }, 5 * 60_000);
}
