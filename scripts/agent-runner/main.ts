// Local AI Lab agent runner.
//
// Polls Card Cloud every minute for pending or scheduled agent runs and
// dispatches them as child processes from the operator's machine. Posts
// final status + log back to Card Cloud after each run.
//
// Runs as a PM2 process (see ecosystem.config.js entry `card-cloud-agent-runner`).
//
// Config via env vars in scripts/agent-runner/.env:
//   CARD_CLOUD_URL          - e.g. https://card-cloud-production.up.railway.app
//   AGENT_RUNNER_TOKEN      - shared secret with Card Cloud's site_credentials.agent_runner_token
//   POLL_INTERVAL_MS        - optional, default 60000
//   PROJECT_ROOT            - optional, default repo root (auto-detected)

import * as fs from "node:fs";
import * as path from "node:path";
import * as cp from "node:child_process";

// Load .env from the runner directory
const ENV_PATH = path.join(__dirname, ".env");
if (fs.existsSync(ENV_PATH)) {
  for (const line of fs.readFileSync(ENV_PATH, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const CARD_CLOUD_URL     = process.env.CARD_CLOUD_URL ?? "";
const AGENT_RUNNER_TOKEN = process.env.AGENT_RUNNER_TOKEN ?? "";
const POLL_INTERVAL_MS   = parseInt(process.env.POLL_INTERVAL_MS ?? "60000");
const PROJECT_ROOT       = process.env.PROJECT_ROOT ?? path.resolve(__dirname, "../..");

if (!CARD_CLOUD_URL || !AGENT_RUNNER_TOKEN) {
  console.error("Missing CARD_CLOUD_URL or AGENT_RUNNER_TOKEN. Configure scripts/agent-runner/.env and restart.");
  process.exit(1);
}

console.log(`[agent-runner] starting`);
console.log(`  CARD_CLOUD_URL  = ${CARD_CLOUD_URL}`);
console.log(`  PROJECT_ROOT    = ${PROJECT_ROOT}`);
console.log(`  POLL_INTERVAL   = ${POLL_INTERVAL_MS}ms`);

interface DueAgent {
  agentId: string;
  script:  string;
  options: Record<string, string>;
  reason:  "pending" | "scheduled";
}

interface PollResponse {
  due:      DueAgent[];
  polledAt: string;
}

let inFlight = new Set<string>();

async function poll(): Promise<void> {
  let data: PollResponse;
  try {
    const r = await fetch(`${CARD_CLOUD_URL}/api/ai-lab/agents/poll`, {
      headers: { Authorization: `Bearer ${AGENT_RUNNER_TOKEN}` },
    });
    if (!r.ok) {
      console.error(`[agent-runner] poll failed: ${r.status} ${await r.text()}`);
      return;
    }
    data = await r.json();
  } catch (e) {
    console.error("[agent-runner] poll error:", e);
    return;
  }

  if (data.due.length === 0) return;
  console.log(`[agent-runner] ${data.due.length} due: ${data.due.map(d => `${d.agentId}(${d.reason})`).join(", ")}`);

  for (const agent of data.due) {
    if (inFlight.has(agent.agentId)) {
      console.log(`[agent-runner] ${agent.agentId} already in flight, skipping`);
      continue;
    }
    inFlight.add(agent.agentId);
    runAgent(agent).finally(() => inFlight.delete(agent.agentId));
  }
}

async function runAgent(agent: DueAgent): Promise<void> {
  const startedAt = new Date().toISOString();
  const logChunks: string[] = [];
  let exitCode: number | null = null;

  const log = (msg: string) => {
    const line = `[${new Date().toISOString().slice(11,19)}] ${msg}`;
    console.log(`[agent-runner:${agent.agentId}] ${line}`);
    logChunks.push(line);
  };

  log(`Starting ${agent.script} (reason: ${agent.reason})`);
  log(`Options: ${JSON.stringify(agent.options)}`);

  try {
    exitCode = await spawnAgent(agent, log);
    log(`Exit code: ${exitCode}`);
  } catch (e) {
    log(`Spawn error: ${e instanceof Error ? e.message : String(e)}`);
    exitCode = -1;
  }

  // Post result back to Card Cloud
  const finalStatus = exitCode === 0 ? "success" : "failed";
  try {
    const r = await fetch(`${CARD_CLOUD_URL}/api/ai-lab/agents/result`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:    `Bearer ${AGENT_RUNNER_TOKEN}`,
      },
      body: JSON.stringify({
        agentId:    agent.agentId,
        status:     finalStatus,
        log:        logChunks.join("\n"),
        startedAt,
        finishedAt: new Date().toISOString(),
      }),
    });
    if (!r.ok) console.error(`[agent-runner:${agent.agentId}] result post failed: ${r.status}`);
  } catch (e) {
    console.error(`[agent-runner:${agent.agentId}] result post error:`, e);
  }
}

function spawnAgent(agent: DueAgent, log: (m: string) => void): Promise<number> {
  // Build the spawn command based on the script field convention:
  //   "npm:<script-name>"     -> npm run <script-name>
  //   "<path-relative-to-scripts>/<name>.ts" -> npx tsx scripts/<rest>
  //   "<path>.ps1"            -> powershell -ExecutionPolicy Bypass -File scripts/<rest>
  //   "<path>.py"             -> python scripts/<rest>
  let cmd:  string;
  let args: string[];
  if (agent.script.startsWith("npm:")) {
    cmd  = "npm.cmd";
    args = ["run", agent.script.slice(4)];
  } else if (agent.script.endsWith(".ts")) {
    cmd  = "npx.cmd";
    args = ["tsx", path.join("scripts", agent.script)];
  } else if (agent.script.endsWith(".ps1")) {
    cmd  = "powershell.exe";
    args = ["-ExecutionPolicy", "Bypass", "-File", path.join("scripts", agent.script)];
  } else if (agent.script.endsWith(".py")) {
    cmd  = "python";
    args = [path.join("scripts", agent.script)];
  } else {
    return Promise.reject(new Error(`Unknown script type: ${agent.script}`));
  }

  // Append options as CLI flags
  for (const [k, v] of Object.entries(agent.options)) {
    if (v === "true")       args.push(`--${k}`);
    else if (v && v !== "false") args.push(`--${k}=${v}`);
    // false / empty: omit
  }

  log(`Spawning: ${cmd} ${args.join(" ")} (cwd=${PROJECT_ROOT})`);

  return new Promise((resolve, reject) => {
    const child = cp.spawn(cmd, args, {
      cwd:   PROJECT_ROOT,
      shell: false,
      env:   process.env,
    });
    child.stdout.on("data", (d: Buffer) => log(d.toString().trimEnd()));
    child.stderr.on("data", (d: Buffer) => log(d.toString().trimEnd()));
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? -1));
  });
}

// Initial poll then interval
poll().catch(e => console.error("[agent-runner] initial poll error:", e));
setInterval(() => {
  poll().catch(e => console.error("[agent-runner] poll error:", e));
}, POLL_INTERVAL_MS);
