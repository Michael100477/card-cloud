import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar — pinned to viewport height; nav scrolls internally when items overflow */}
      <aside className="w-56 shrink-0 bg-navy flex flex-col h-screen fixed top-0 left-0 z-30">
        <div className="px-5 py-5 border-b border-white/10 shrink-0">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-0.5">Admin</p>
          <p className="text-white font-bold text-base">Card Cloud</p>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 flex flex-col gap-0.5">
          {NAV.map((item, i) =>
            "section" in item ? (
              <p key={i} className="text-white/25 text-xs font-semibold uppercase tracking-widest px-3 pt-4 pb-1 first:pt-0">
                {item.section}
              </p>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/8 text-sm transition-colors"
              >
                <span className="text-base leading-none w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="px-3 py-4 border-t border-white/10 shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white/70 text-xs transition-colors"
          >
            ← Exit admin
          </Link>
        </div>
      </aside>

      {/* Main — centered, responsive. min-w-0 + overflow-x-hidden so wide
          children (tables, code blocks) cause an internal scrollbar instead
          of pushing the viewport out horizontally. */}
      <main className="ml-56 flex-1 min-w-0 min-h-screen bg-slate-100 overflow-x-hidden">
        <div className="max-w-screen-xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
