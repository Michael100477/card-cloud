// PM2 launcher for the agent runner. PM2 can't directly exec `npx tsx`,
// so this small wrapper spawns it as a child process and inherits stdio.

const { spawn } = require("node:child_process");
const path = require("node:path");

const proc = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", path.join(__dirname, "main.ts")],
  // shell: true required on Node 24+ to spawn .cmd shims on Windows
  { stdio: "inherit", env: process.env, cwd: __dirname, shell: true }
);

proc.on("exit", code => process.exit(code ?? 0));
proc.on("error", e => { console.error(e); process.exit(1); });
