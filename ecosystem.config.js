/** @type {import('pm2').StartOptions[]} */
module.exports = {
  apps: [
    {
      name: "card-cloud-db",
      script: "./scripts/start-db.js",
      watch: false,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 8000,
    },
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
};
