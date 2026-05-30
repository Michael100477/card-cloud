// DATABASE_URL is declared in prisma/schema.prisma via env("DATABASE_URL"),
// so the CLI can resolve it directly without dotenv preloading. This file
// only configures the schema + migrations paths.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
