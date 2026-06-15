// One-time interactive Facebook login. Run this before the first discovery
// pass, and re-run any time FB invalidates the session (re-prompts you when
// you next try to discover).
//
// Usage: npx tsx scripts/social-discovery/auth.ts

import { chromium } from "playwright";
import * as path from "node:path";
import * as fs from "node:fs";
import * as readline from "node:readline";

const SESSION_PATH = path.join(__dirname, ".fb-session.json");

function waitForEnter(prompt: string): Promise<void> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, () => { rl.close(); resolve(); });
  });
}

(async () => {
  console.log("Launching browser. A window will open — log in to Facebook normally.");
  console.log("If FB asks for 2FA or a security check, complete it as usual.\n");

  const browser = await chromium.launch({ headless: false });
  const ctx     = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page    = await ctx.newPage();

  await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded" });

  await waitForEnter(
    "Press ENTER here once you are logged in and your Facebook home feed is visible. "
  );

  // Save the storage state (cookies + localStorage) so future runs are silent
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
  await ctx.storageState({ path: SESSION_PATH });
  console.log(`\n✓ Session saved to ${SESSION_PATH}`);
  console.log("From now on the discovery script will use this session — no manual login required.");
  console.log("If FB ever invalidates the session, re-run this script to refresh.\n");

  await browser.close();
  process.exit(0);
})().catch(e => {
  console.error("Auth failed:", e);
  process.exit(1);
});
