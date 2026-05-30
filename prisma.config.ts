// Prisma 7: the datasource URL must live in this config file (it's no longer
// permitted in schema.prisma). dotenv preload handles local dev; in
// production (Railway, Fly, etc.) the env var comes from the platform.
//
// Note: we deliberately do NOT throw here when DATABASE_URL is missing.
// `prisma generate` runs at build time (where Railway doesn't inject
// runtime env vars) and doesn't need a database connection — only the
// schema. Commands that DO need a URL (migrate deploy, db push) will
// surface a clear error themselves.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "",
  },
});
