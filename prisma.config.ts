// Prisma 7: the datasource URL must live in this config file (it's no longer
// permitted in schema.prisma). dotenv preload handles local dev; in
// production (Railway, Fly, etc.) the env var comes from the platform.
import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Local dev: copy .env.example to .env. Production: set it on your hosting provider before running prisma commands.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
