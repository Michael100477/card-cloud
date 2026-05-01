/** @type {import('pm2').StartOptions[]} */
module.exports = {
  apps: [
    {
      name: "card-cloud-db",
      script: "./scripts/start-db.js",
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,
    },
    {
      name: "card-cloud-app",
      script: "./scripts/start-app.js",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
};
