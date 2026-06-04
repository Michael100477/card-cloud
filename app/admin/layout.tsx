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
  { section: "AI Lab" },
  { href: "/admin/ai-lab",          label: "AI Overview",   icon: "📊" },
  { href: "/admin/ai-lab/messages",  label: "Messages",      icon: "💬" },
  { href: "/admin/ai-lab/agents",   label: "Agents",        icon: "🤖" },
  { href: "/admin/ai-lab/models",   label: "Ollama Models", icon: "💡" },
  { href: "/admin/ai-lab/testing",    label: "Model Testing",  icon: "🧪" },
  { href: "/admin/ai-lab/photo-fix",      label: "Photo Straightener", icon: "📷" },
  { href: "/admin/ai-lab/photo-training", label: "Photo Training",     icon: "🎯" },
  { href: "/admin/training",          label: "Training Data",  icon: "🧠" },
];

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
