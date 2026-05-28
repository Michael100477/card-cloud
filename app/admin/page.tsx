import Link from "next/link";
import { db } from "@/lib/db";

export default async function AdminOverviewPage() {
  const [userCount, cardCount, collectionCount, threadCount, pendingTraining, recentUsers] = await Promise.all([
    db.user.count(),
    db.card.count(),
    db.collection.count(),
    db.emailThread.count(),
    db.trainingExample.count({ where: { verified: false } }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, email: true, displayName: true, username: true,
        planTier: true, isAdmin: true, createdAt: true,
        _count: { select: { cards: true } },
      },
    }),
  ]);

  const stats = [
    { label: "Total users",        value: userCount.toLocaleString(),      href: "/admin/users",       color: "bg-brand" },
    { label: "Cards tracked",      value: cardCount.toLocaleString(),       href: "/admin/cards",       color: "bg-green-600" },
    { label: "Collections",        value: collectionCount.toLocaleString(), href: "/admin/users",       color: "bg-purple-600" },
    { label: "Support threads",    value: threadCount.toLocaleString(),     href: "/dashboard/email",   color: "bg-amber-500" },
    { label: "Pending training",   value: pendingTraining.toLocaleString(), href: "/admin/training",    color: pendingTraining > 0 ? "bg-red-500" : "bg-slate-400" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">Admin Overview</h1>
      <p className="text-slate-400 text-sm mb-8">Platform health at a glance</p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-sm transition-shadow">
            <div className={`w-2 h-2 rounded-full ${s.color} mb-3`} />
            <p className="text-navy text-2xl font-bold">{s.value}</p>
            <p className="text-slate-400 text-xs mt-1">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Recent signups */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-navy font-semibold">Recent signups</h2>
          <Link href="/admin/users" className="text-brand text-sm hover:underline">View all →</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-6 py-3">User</th>
              <th className="text-left px-6 py-3">Plan</th>
              <th className="text-left px-6 py-3">Cards</th>
              <th className="text-left px-6 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.map((u, i) => (
              <tr key={u.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                <td className="px-6 py-3">
                  <p className="text-navy font-medium">{u.displayName ?? u.username ?? "—"}</p>
                  <p className="text-slate-400 text-xs">{u.email}</p>
                </td>
                <td className="px-6 py-3">
                  <PlanBadge plan={u.planTier} />
                  {u.isAdmin && <span className="ml-1.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">admin</span>}
                </td>
                <td className="px-6 py-3 text-slate-500">{u._count.cards}</td>
                <td className="px-6 py-3 text-slate-400 text-xs">{u.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const cls: Record<string, string> = {
    FREE:    "bg-slate-100 text-slate-500",
    TRIAL:   "bg-blue-100 text-blue-700",
    MONTHLY: "bg-green-100 text-green-700",
    ANNUAL:  "bg-emerald-100 text-emerald-700",
  };
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${cls[plan] ?? "bg-slate-100 text-slate-500"}`}>{plan}</span>;
}
