/**
 * Generates the APPLE_SECRET JWT required for Sign In with Apple.
 * Valid for 6 months — re-run before it expires.
 *
 * Usage:
 *   node scripts/generate-apple-secret.js TEAM_ID KEY_ID SERVICE_ID path/to/AuthKey_KEYID.p8
 *
 * Example:
 *   node scripts/generate-apple-secret.js AB12CD34EF 1234ABCDEF com.thecardcloud.web ./AuthKey_1234ABCDEF.p8
 *
 * Then copy the output into APPLE_SECRET in your .env file.
 */

const crypto = require("crypto");
const fs     = require("fs");

const [,, teamId, keyId, serviceId, keyPath] = process.argv;

if (!teamId || !keyId || !serviceId || !keyPath) {
  console.error("Usage: node generate-apple-secret.js TEAM_ID KEY_ID SERVICE_ID path/to/key.p8");
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath, "utf8");

// Build the JWT header + payload manually and sign with ES256
function base64url(input) {
  return Buffer.from(JSON.stringify(input))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

const now     = Math.floor(Date.now() / 1000);
const expires = now + 60 * 60 * 24 * 180; // 6 months

const header  = base64url({ alg: "ES256", kid: keyId });
const payload = base64url({
  iss: teamId,
  iat: now,
  exp: expires,
  aud: "https://appleid.apple.com",
  sub: serviceId,
});

const unsigned = `${header}.${payload}`;
const sign     = crypto.createSign("SHA256");
sign.update(unsigned);
const signature = sign
  .sign({ key: privateKey, dsaEncoding: "ieee-p1363" })
  .toString("base64")
  .replace(/=/g, "")
  .replace(/\+/g, "-")
  .replace(/\//g, "_");

const jwt = `${unsigned}.${signature}`;

console.log("\n✅ Apple secret generated. Add this to your .env as APPLE_SECRET:\n");
console.log(jwt);
console.log(`\nExpires: ${new Date(expires * 1000).toLocaleDateString()} (6 months)\n`);
