const { spawn, execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

// Stop any existing prisma dev server before starting — releases stale lock files
// left behind when the process was killed abruptly by PM2.
try {
  execSync("npx prisma dev stop", { cwd: root, stdio: "ignore", timeout: 10_000 });
} catch {
  // Ignore — stop fails if nothing is running, which is fine
}

const child = spawn("npm", ["run", "dev:db"], { stdio: "inherit", shell: true, cwd: root, windowsHide: true });

process.on("SIGINT",  () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 0));
