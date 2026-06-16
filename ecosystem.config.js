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
  ],
  // AI Lab agent runner is now managed by C:\CC-AI-Lab's ecosystem.config.js
  // as pm2 app "cc-ai-lab-runner". See that repo for the dispatch architecture.
};
