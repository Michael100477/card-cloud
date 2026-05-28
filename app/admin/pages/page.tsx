import { db } from "@/lib/db";
import { PagesClient } from "./PagesClient";

// Seed — pages that exist now or are planned. Runs once; safe to re-run.
const SEED_PAGES = [
  // Current pages
  { path: "/",                        label: "Home",                order: 1  },
  { path: "/signup",                  label: "Sign Up",             order: 2  },
  { path: "/login",                   label: "Log In",              order: 3  },
  { path: "/dashboard",              label: "My Cards",            order: 10 },
  { path: "/dashboard/watchlist",    label: "Watchlist",           order: 11 },
  { path: "/dashboard/following",    label: "Following",           order: 12 },
  { path: "/dashboard/consign",      label: "Consign Cards",       order: 13 },
  { path: "/dashboard/consignments", label: "My Consignments",     order: 14 },
  { path: "/dashboard/trade",        label: "Trade",               order: 15 },
  { path: "/dashboard/profile",      label: "My Profile",          order: 16 },
  { path: "/dashboard/settings",     label: "Settings",            order: 17 },
  // Planned
  { path: "/explore",                label: "Explore Collectors",  order: 20 },
  { path: "/sell",                   label: "Sell a Card",         order: 21 },
  { path: "/trade",                  label: "Trade",               order: 22 },
  { path: "/grading",                label: "Grading Guide",                   order: 30 },
  { path: "/pricing",                label: "Pricing",                         order: 31 },
  // How It Works
  { path: "/how-it-works",           label: "How It Works",                    order: 32 },
  { path: "/how-it-works/track",     label: "How To: Track Your Collection",   order: 33 },
  { path: "/how-it-works/sell",      label: "How To: Sell on The Exchange",    order: 34 },
  { path: "/how-it-works/offer",     label: "How To: Get an Offer",            order: 35 },
  { path: "/how-it-works/consign",   label: "How To: Consign a Card",          order: 36 },
  { path: "/how-it-works/trade",     label: "How To: Trade",                   order: 37 },
  // The Exchange
  { path: "/exchange/sell",          label: "The Exchange — Sell a Card",      order: 45 },
  { path: "/support",                label: "Support",                         order: 58 },
  { path: "/faq",                    label: "FAQ",                             order: 59 },
  { path: "/about",                  label: "About",                           order: 60 },
  { path: "/contact",                label: "Contact",                         order: 61 },
  { path: "/privacy",                label: "Privacy Policy",                  order: 70 },
  { path: "/terms",                  label: "Terms of Service",                order: 71 },
];

export default async function AdminPagesPage() {
  // Seed any missing pages
  const existing = await db.sitePage.findMany({ select: { path: true } });
  const existingPaths = new Set(existing.map(p => p.path));
  const toSeed = SEED_PAGES.filter(p => !existingPaths.has(p.path));
  if (toSeed.length > 0) {
    await db.sitePage.createMany({ data: toSeed });
  }

  const pages = await db.sitePage.findMany({ orderBy: [{ order: "asc" }, { label: "asc" }] });
  return <PagesClient initialPages={pages} />;
}
