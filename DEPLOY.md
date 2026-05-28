# Deploying The Card Cloud

This runbook walks through getting the site live on Railway with Cloudflare R2
photo storage. Local dev keeps using PGlite and the local filesystem — production
gets hosted Postgres + R2 with zero code changes.

## Architecture

```
Browser ──> Railway (Next.js app + Postgres)
              │
              ├── /uploads/*       → Cloudflare R2 bucket (public)
              ├── auth callbacks   → NextAuth (Google, optional Apple)
              ├── /api/ebay/*      → eBay APIs
              └── outbound email   → SMTP (or Resend fallback)
```

- **Hosting**: Railway. Builds with Nixpacks, restarts on crash, exposes one
  public URL (e.g. `card-cloud-production.up.railway.app`). Custom domain
  attached later.
- **Database**: Railway-managed Postgres (one click in dashboard). Prisma
  migrations applied on every deploy via `start:prod`.
- **Photo storage**: Cloudflare R2 (S3-compatible). Public bucket served from
  `photos.thecardcloud.com` or `<bucket>.r2.dev`.
- **Email**: SMTP via Office 365 or Gmail (same as local). Resend is fallback.

## One-time setup (Mike does these in a browser)

### 1. Cloudflare R2

1. Sign in at <https://dash.cloudflare.com> → R2 (left sidebar).
2. **Create bucket** → name it `cardcloud-photos` → location: Automatic.
3. After the bucket exists, click **Settings** → **Public access** → enable
   "Public R2.dev bucket URL". Copy the URL it shows
   (`https://pub-<hash>.r2.dev`) — that's `R2_PUBLIC_URL`.
   - *Later*: replace with a custom domain (`photos.thecardcloud.com`) for
     prettier image URLs. R2 → bucket → Settings → Custom Domains.
4. R2 sidebar → **Manage R2 API Tokens** → **Create API token**.
   - Permission: **Object Read & Write**
   - Specify bucket: `cardcloud-photos`
   - TTL: forever
   - Create → copy:
     - **Access Key ID** → `R2_ACCESS_KEY_ID`
     - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`
5. The Account ID is shown on every R2 page in the right sidebar →
   `R2_ACCOUNT_ID`. Also visible in the URL of the R2 dashboard.

You now have all 5 R2 values. These go into the admin dashboard
(Platform → Credentials → Storage) — they are NOT Railway env vars. See the
"R2 credentials" subsection under step 2.6 below.

### 2. Railway

1. Sign in at <https://railway.app> with the same GitHub account that owns
   `Michael100477/card-cloud`.
2. New Project → **Deploy from GitHub repo** → pick `card-cloud`.
3. Railway will start a build immediately — let it run; it will fail on the
   missing `DATABASE_URL`. That's expected.
4. In the project view → **+ New** → **Database** → **Add PostgreSQL**.
5. Click the new Postgres service → **Connect** tab → copy the
   `DATABASE_URL` string (starts with `postgresql://`).
6. Switch to the app service → **Variables** tab → paste in *every*
   variable from `.env.example` that has a production value. Important ones:
   - `DATABASE_URL` — paste the Postgres URL from step 5
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — `https://<your-railway-url>.up.railway.app` for now;
     update later when DNS is cut over
   - `NEXT_PUBLIC_BASE_URL` and `NEXT_PUBLIC_APP_URL` — same value as `NEXTAUTH_URL`
   - `ADMIN_EMAIL` — `virus860@gmail.com`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   - `ANTHROPIC_API_KEY`
   - `PSA_ACCESS_TOKEN`
   - eBay: `EBAY_PROD_APP_ID`, `EBAY_PROD_CERT_ID`,
     `EBAY_DELETION_VERIFICATION_TOKEN`, `EBAY_DELETION_ENDPOINT_URL`
   - SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
   - `RECEIVE_TOKEN_SECRET` — generate with `openssl rand -base64 32`
   - `EMAIL_WEBHOOK_SECRET` — generate with `openssl rand -base64 32`
7. Hit **Deploy** (or push any commit to `main` to retrigger).

**R2 credentials (separate from Railway env vars):** Once the app is deployed
and you can log in as the admin, go to **Admin → Platform → Credentials →
Storage** and fill in the five R2 fields from step 1:
   - `r2_account_id` — 32-char hex
   - `r2_access_key` — R2 API token access key
   - `r2_secret_key` — R2 API token secret
   - `r2_bucket` — `cardcloud-photos`
   - `r2_public_url` — `https://pub-<hash>.r2.dev` (no trailing slash)

Save. Photo uploads switch to R2 immediately — no app restart needed.

### 3. Update Google OAuth for the Railway URL

Google won't accept the new redirect URI by default — every URL has to be on
the allowlist.

1. Go to <https://console.cloud.google.com> → project "The Card Cloud" →
   **APIs & Services** → **Credentials** → click the OAuth client.
2. **Authorized redirect URIs** → add:
   `https://<your-railway-url>.up.railway.app/api/auth/callback/google`
3. **Authorized JavaScript origins** → add:
   `https://<your-railway-url>.up.railway.app`
4. Save. Changes propagate in a few minutes.

## How a deploy works

Every push to `main`:

1. Railway pulls the new commit.
2. Nixpacks installs Node.js + dependencies (`npm ci` → triggers
   `postinstall` which runs `prisma generate`).
3. `npm run build` builds the Next.js production bundle.
4. Railway starts the container with `npm run start:prod`, which runs
   `prisma migrate deploy` (applies any new migrations) and then
   `next start` (port from `$PORT`).
5. Railway hits `GET /api/health` until it returns 200, then routes traffic
   to the new instance.

## Smoke test after first deploy

1. Open `https://<your-railway-url>.up.railway.app` — landing page loads.
2. `/api/health` returns `{ "ok": true }`.
3. Sign in with Google.
4. Upload a card photo → check the URL in DevTools → it should point at
   `R2_PUBLIC_URL/uploads/...`, not `/uploads/...`.
5. Visit `/admin` (signed in as `ADMIN_EMAIL`) → settings page loads.

If any step fails, check Railway → **Deployments** → click the latest one →
**Logs** for the stack trace.

## Custom domain cutover (later, when ready)

This step replaces `<railway-url>` with `thecardcloud.com`. Do this AFTER the
Railway deploy is healthy and you've decided to retire the GoDaddy-hosted PHP
site.

1. Railway → app service → **Settings** → **Networking** → **Custom Domain** →
   add `thecardcloud.com` and `www.thecardcloud.com`.
2. Railway shows a CNAME target like `<something>.up.railway.app`.
3. Log into GoDaddy → DNS → for `thecardcloud.com`:
   - Delete the existing A record pointing at the GoDaddy server.
   - Add a CNAME (or ALIAS / ANAME for the root) pointing at Railway's target.
   - DNS propagation: ~10 minutes to 24 hours.
4. Update env vars in Railway → set `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`,
   and `NEXT_PUBLIC_APP_URL` to `https://thecardcloud.com`.
5. Update Google OAuth (same steps as section 3 above, but with the real
   domain) — keep the Railway URL in the list too so the auto-URL still works
   as a backup.
6. Update eBay → Application Keysets → Production → **Marketplace Account
   Deletion Notice Endpoint** → set to
   `https://thecardcloud.com/api/ebay/marketplace-deletion`.

## Rollback

Railway → **Deployments** → find a known-good deploy → **Redeploy**. The
release replaces the broken one; no migration is run (existing migrations
are idempotent on `migrate deploy`).

For a code rollback that *includes* reverting a migration: don't. Always
roll forward — write a new migration that undoes the change rather than
trying to `migrate reset` against production.
