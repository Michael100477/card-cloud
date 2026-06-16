import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { AdminShell } from "./AdminShell";

const NAV = [
  { section: "Platform" },
  { href: "/admin",             label: "Overview",       icon: "▦" },
  { href: "/admin/settings",    label: "Settings",       icon: "⚙️"  },
  { href: "/admin/users",       label: "Users",          icon: "👥" },
  { href: "/admin/credentials", label: "API Keys",       icon: "🔑" },
  { href: "/admin/pages",       label: "Pages",          icon: "🔗" },
  { href: "/admin/articles",    label: "Articles",       icon: "📰" },
  { href: "/admin/cards",       label: "Featured Cards", icon: "⭐" },
  { section: "Consignment" },
  { href: "/admin/consignments",  label: "Orders",          icon: "📦" },
  { href: "/admin/listings",      label: "eBay Listings",   icon: "🛒" },
  { href: "/admin/shipping",      label: "Shipping",        icon: "📮" },
  { href: "/admin/trades",        label: "Trades",          icon: "🔄" },
  { href: "/admin/ebay-defaults", label: "Listing Defaults", icon: "⚙️"  },
  { section: "System" },
  { href: "/admin/logs",          label: "Logs",            icon: "📋" },
  { href: "/admin/training",      label: "Training Data",   icon: "🧠" },
];

// AI Lab moved to a local-only site at C:\CC-AI-Lab (port 3003, password-gated,
// LAN-reachable). See docs/AI_LAB_OVERVIEW.md in that repo for details.

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { isAdmin: true, email: true },
  });

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!user?.isAdmin && user?.email !== adminEmail) redirect("/dashboard");

  return <AdminShell nav={NAV}>{children}</AdminShell>;
}
