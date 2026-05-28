"use client";

import { useEffect, useState, useCallback } from "react";

interface User {
  id: string; email: string; displayName: string | null; username: string | null;
  planTier: string; isAdmin: boolean; isFeatured: boolean; suspended: boolean;
  suspendedReason: string | null; createdAt: string;
  cardCount: number; collectionCount: number; followerCount: number;
  recentCards: number; watches: number; engagementScore: number;
}

const PLANS = ["FREE", "TRIAL", "MONTHLY", "ANNUAL", "GIFTED"];

export default function AdminUsersPage() {
  const [users,    setUsers]    = useState<User[]>([]);
  const [search,   setSearch]   = useState("");
  const [sortBy,   setSortBy]   = useState<"engagement" | "joined">("engagement");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/users?q=${encodeURIComponent(search)}`);
    setUsers(await r.json());
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function patch(id: string, data: object) {
    setSaving(id);
    const r = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    setSaving(null);
  }

  async function deleteUser(user: User) {
    if (!confirm(`Permanently delete ${user.displayName ?? user.email}?\n\nThis deletes ALL their cards, collections, and data. Cannot be undone.`)) return;
    setDeleting(user.id);
    const r = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (r.ok) setUsers(prev => prev.filter(u => u.id !== user.id));
    else alert("Could not delete — you may not delete your own account.");
    setDeleting(null);
  }

  async function confirmSuspend() {
    if (!suspendTarget) return;
    const isSuspending = !suspendTarget.suspended;
    await patch(suspendTarget.id, {
      suspended: isSuspending,
      suspendedReason: isSuspending ? suspendReason : null,
    });
    setSuspendTarget(null); setSuspendReason("");
  }

  const sorted = [...users].sort((a, b) =>
    sortBy === "engagement" ? b.engagementScore - a.engagementScore : 0
  );

  const featuredCount  = users.filter(u => u.isFeatured).length;
  const suspendedCount = users.filter(u => u.suspended).length;
  const giftedCount    = users.filter(u => u.planTier === "GIFTED").length;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">Users</h1>
      <p className="text-slate-400 text-sm mb-6">
        {users.length} users · {featuredCount} featured · {giftedCount} gifted · {suspendedCount} suspended
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or name…"
          className="flex-1 min-w-64 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30" />
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {(["engagement","joined"] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${sortBy === s ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
              {s === "engagement" ? "By engagement" : "By join date"}
            </button>
          ))}
        </div>
      </div>

      {/* Suspend modal */}
      {suspendTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-navy font-bold text-lg mb-2">
              {suspendTarget.suspended ? "Unsuspend" : "Suspend"} {suspendTarget.displayName ?? suspendTarget.email}
            </h2>
            {!suspendTarget.suspended ? (
              <>
                <p className="text-slate-500 text-sm mb-3">
                  The user will see a suspension notice when they log in and cannot access the dashboard while suspended.
                </p>
                <label className="text-slate-400 text-xs mb-1 block">Reason <span className="text-slate-300">(shown to user, optional)</span></label>
                <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
                  rows={3} placeholder="e.g. Violation of terms of service"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 mb-4" />
              </>
            ) : (
              <p className="text-slate-500 text-sm mb-4">This will restore their full access immediately.</p>
            )}
            <div className="flex gap-2">
              <button onClick={confirmSuspend}
                className={`flex-1 font-semibold text-sm py-2.5 rounded-xl ${suspendTarget.suspended ? "bg-green-600 text-white hover:bg-green-700" : "bg-amber-600 text-white hover:bg-amber-700"}`}>
                {suspendTarget.suspended ? "Restore access" : "Suspend account"}
              </button>
              <button onClick={() => { setSuspendTarget(null); setSuspendReason(""); }}
                className="px-4 border border-slate-200 text-slate-500 text-sm rounded-xl hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3">User</th>
              <th className="text-left px-5 py-3">Plan</th>
              <th className="text-left px-5 py-3 hidden lg:table-cell">Engagement</th>
              <th className="text-left px-5 py-3 hidden md:table-cell">Stats</th>
              <th className="text-left px-5 py-3">Featured</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">Loading…</td></tr>}
            {!loading && sorted.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No users found</td></tr>}
            {sorted.map((u, i) => (
              <tr key={u.id} className={`${i % 2 === 0 ? "" : "bg-slate-50/50"} ${u.suspended ? "opacity-60" : ""} ${saving === u.id || deleting === u.id ? "opacity-50 pointer-events-none" : ""}`}>
                <td className="px-5 py-3">
                  <p className="text-navy font-medium flex items-center gap-1.5">
                    {u.displayName ?? u.username ?? "—"}
                    {u.suspended && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">Suspended</span>}
                    {u.isAdmin  && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">Admin</span>}
                  </p>
                  <p className="text-slate-400 text-xs">{u.email}</p>
                  {u.suspended && u.suspendedReason && <p className="text-slate-400 text-xs mt-0.5 italic">"{u.suspendedReason}"</p>}
                </td>
                <td className="px-5 py-3">
                  <select value={u.planTier} onChange={e => patch(u.id, { planTier: e.target.value })}
                    className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand/30">
                    {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {u.planTier === "GIFTED" && <p className="text-xs text-purple-600 font-medium mt-1">🎁 Gifted membership</p>}
                </td>
                <td className="px-5 py-3 hidden lg:table-cell">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${u.engagementScore > 50 ? "bg-green-500" : u.engagementScore > 10 ? "bg-amber-400" : "bg-slate-200"}`} />
                    <span className="text-navy font-semibold">{u.engagementScore}</span>
                  </div>
                  <p className="text-slate-400 text-xs">{u.recentCards} recent · {u.watches} watches</p>
                </td>
                <td className="px-5 py-3 hidden md:table-cell text-xs text-slate-500">
                  <p>{u.cardCount} cards · {u.collectionCount} cols</p>
                  <p>{u.followerCount} followers</p>
                </td>
                <td className="px-5 py-3">
                  <button onClick={() => patch(u.id, { isFeatured: !u.isFeatured })}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors ${u.isFeatured ? "bg-amber/20 text-amber-dark" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                    {u.isFeatured ? "⭐ Featured" : "☆ Feature"}
                  </button>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-col gap-1 items-start min-w-max">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={u.isAdmin} onChange={e => patch(u.id, { isAdmin: e.target.checked })} className="rounded" />
                      <span className="text-xs text-slate-500">Admin</span>
                    </label>
                    <button onClick={() => setSuspendTarget(u)}
                      className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${u.suspended ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}`}>
                      {u.suspended ? "Unsuspend" : "Suspend"}
                    </button>
                    <button onClick={() => deleteUser(u)} disabled={deleting === u.id}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50">
                      {deleting === u.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
