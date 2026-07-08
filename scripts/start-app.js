const { spawn } = require("child_process");
const path = require("path");

// Spawn `next dev -p 3001` DIRECTLY via node — no cmd.exe wrapper, no
// npm layer. On Windows, spawning through `shell: true` produces a
// visible cmd window in the taskbar even with `windowsHide: true`,
// because it's the intermediate cmd.exe (not the child) that shows.
// Going straight to the next.js binary sidesteps the whole tree.

const projectRoot = path.join(__dirname, "..");
const nextBin     = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextBin, "dev", "-p", "3001"], {
  cwd:         projectRoot,
  stdio:       "inherit",
  windowsHide: true,
});

process.on("SIGINT",  () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 0));
