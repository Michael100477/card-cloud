const { spawn } = require("child_process");

const child = spawn("npm", ["run", "dev:db"], { stdio: "inherit", shell: true });

process.on("SIGINT",  () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 0));
