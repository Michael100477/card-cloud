/**
 * Keeps the prisma dev database alive by sending a lightweight query every
 * 4 minutes. Without this, prisma dev idles out and drops all connections.
 * Also retries on startup until the DB is ready.
 */

const { Client } = require("pg");
require("dotenv").config();

const DB_URL   = process.env.DATABASE_URL;
const INTERVAL = 4 * 60 * 1000; // 4 minutes

async function ping() {
  const client = new Client({ connectionString: DB_URL });
  try {
    await client.connect();
    await client.query("SELECT 1");
    console.log(`[keepalive] ${new Date().toISOString()} — DB ping ok`);
  } catch (e) {
    console.error(`[keepalive] ${new Date().toISOString()} — ping failed: ${e.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

// On startup, wait until the DB is accepting connections before starting the interval
async function waitForDb(attempts = 0) {
  const client = new Client({ connectionString: DB_URL });
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    console.log(`[keepalive] DB ready after ${attempts} attempt(s)`);
    setInterval(ping, INTERVAL);
  } catch {
    await client.end().catch(() => {});
    if (attempts < 30) {
      setTimeout(() => waitForDb(attempts + 1), 3000);
    } else {
      console.error("[keepalive] DB never became ready — giving up");
      process.exit(1);
    }
  }
}

waitForDb();
