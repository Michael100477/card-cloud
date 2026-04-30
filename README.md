# The Card Cloud

Sports card tracking, selling, consigning, and trading platform.

Built with Next.js 16, TypeScript, Tailwind CSS v4, and Prisma 6.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher (project uses v24)
- npm v10 or higher

---

## Local setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd card-cloud

# 2. Install dependencies
npm install

# 3. Copy the example env file
cp .env.example .env

# 4. Start the local database (Prisma manages Postgres — no separate install needed)
npx prisma dev

# 5. In a second terminal, run the dev server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).
(Port 3000 is occupied by Docker on the dev machine, so Next.js uses 3001.)

---

## Database

Prisma 6 includes a built-in local Postgres server — no separate PostgreSQL installation required for development.

```bash
# Start the local database (keep running in a separate terminal)
npx prisma dev

# Generate the Prisma client after any schema change
npx prisma generate

# Apply schema changes and create a migration
npx prisma migrate dev --name <describe-change>

# Open Prisma Studio (visual database browser)
npx prisma studio
```

For a hosted database, replace `DATABASE_URL` in `.env` with a standard `postgresql://` connection string.

---

## Project structure

```
card-cloud/
├── app/
│   ├── layout.tsx          # Root layout — metadata, global CSS
│   ├── page.tsx            # Landing page composition
│   └── globals.css         # Brand color tokens (@theme) + base styles
│
├── components/
│   ├── nav/TopNav.tsx      # Site-wide navigation bar
│   └── landing/
│       ├── Hero.tsx            # Navy hero + four service path cards
│       ├── CardGraphic.tsx     # SVG fan of trading cards
│       ├── CommunityPitch.tsx  # Community value prop + stats
│       ├── CommunityFeed.tsx   # Social activity feed (collector posts)
│       ├── ArticleStrip.tsx    # Hobby Desk article previews
│       └── FooterCTA.tsx       # Navy CTA band + page footer
│
├── lib/
│   ├── db.ts               # Prisma client singleton
│   └── utils.ts            # cn() class-name helper (clsx + tailwind-merge)
│
├── prisma/
│   └── schema.prisma       # Database models: User, Card
│
└── prisma.config.ts        # Prisma database connection config
```

---

## Brand colors

| Token           | Hex       | Usage                                |
|-----------------|-----------|--------------------------------------|
| `navy`          | `#042C53` | Hero sections, nav, dark backgrounds |
| `brand`         | `#185FA5` | Links, primary buttons, accents      |
| `amber`         | `#EF9F27` | CTAs on dark/navy backgrounds        |
| `light-navy`    | `#0C447C` | Hover states on blue elements        |
| `sky-highlight` | `#85B7EB` | Secondary text on dark backgrounds   |
| `success`       | `#3B6D11` | Value gains, positive states         |
| `alert`         | `#A32D2D` | Errors, value losses                 |

> **Rule:** Always use amber buttons on navy backgrounds — never blue on blue.

---

## Environment variables

| Variable       | Description                        |
|----------------|------------------------------------|
| `DATABASE_URL` | Prisma Postgres connection string  |

See `.env.example` for the template.
