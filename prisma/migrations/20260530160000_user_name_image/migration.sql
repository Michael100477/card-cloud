-- Add the `name` and `image` columns Auth.js's PrismaAdapter writes during
-- OAuth sign-in. Both are nullable; existing rows pick up NULL by default.
ALTER TABLE "users" ADD COLUMN "name"  TEXT;
ALTER TABLE "users" ADD COLUMN "image" TEXT;
