/** @type {import('pm2').StartOptions[]} */
// Local dev Postgres runs in Docker (`card-cloud-postgres` container,
// port 5433). The previous PGlite-via-`prisma dev` pm2 process kept idle-
// disconnecting and is no longer managed here. Start the container with:
//   docker start card-cloud-postgres
// or recreate it from scratch — see README / CLAUDE_CHANGELOG.
module.exports = {
  apps: [
    {
      name: "card-cloud-app",
      script: "./scripts/start-app.js",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
    },
    {
      name: "card-cloud-keepalive",
      script: "./scripts/keepalive-db.js",
      watch: false,
      autorestart: true,
      max_restarts: 50,
      restart_delay: 10000,
    },
    {
      // Local AI Lab agent runner — polls Card Cloud every minute for
      // pending or scheduled agent runs and dispatches them as child
      // processes on this machine. See scripts/agent-runner/.env.example
      // for required config. The .env file is gitignored — copy from
      // example and fill in CARD_CLOUD_URL + AGENT_RUNNER_TOKEN first.
      name: "card-cloud-agent-runner",
      script: "./scripts/agent-runner/start.js",
      watch:  false,
      autorestart: true,
      max_restarts: 100,
      restart_delay: 5000,
    },
  ],
};
