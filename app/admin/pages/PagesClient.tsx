"use client";

import { useState } from "react";
import Link from "next/link";

interface SitePage { id: string; path: string; label: string; order: number }

export function PagesClient({ initialPages }: { initialPages: SitePage[] }) {
  const [pages,    setPages]   = useState<SitePage[]>(initialPages);
  const [editing,  setEditing] = useState<string | null>(null);
  const [editPath, setEditPath] = useState("");
  const [editLabel,setEditLabel] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving,   setSaving]   = useState<string | null>(null);

  // Add form
  const [newPath,    setNewPath]    = useState("");
  const [newLabel,   setNewLabel]   = useState("");
  const [addSaving,  setAddSaving]  = useState(false);
  const [addError,   setAddError]   = useState("");

  // ── Edit ─────────────────────────────────────────────────────────────────

  function startEdit(p: SitePage) {
    setEditing(p.id);
    setEditPath(p.path);
    setEditLabel(p.label);
  }

  async function saveEdit(id: string) {
    setSaving(id);
    const r = await fetch(`/api/admin/pages/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: editPath, label: editLabel }),
    });
    if (r.ok) {
      const updated = await r.json();
      setPages(prev => prev.map(p => p.id === id ? updated : p));
      setEditing(null);
    }
    setSaving(null);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function deletePage(id: string, label: string) {
    if (!confirm(`Remove "${label}" from the page list?`)) return;
    setDeleting(id);
    await fetch(`/api/admin/pages/${id}`, { method: "DELETE" });
    setPages(prev => prev.filter(p => p.id !== id));
    setDeleting(null);
  }

  // ── Add ───────────────────────────────────────────────────────────────────

  async function addPage(e: React.FormEvent) {
    e.preventDefault();
    if (!newPath.trim() || !newLabel.trim()) {
      setAddError("Both fields are required."); return;
    }
    const path = newPath.trim().startsWith("/") ? newPath.trim() : `/${newPath.trim()}`;
    setAddSaving(true); setAddError("");
    const r = await fetch("/api/admin/pages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, label: newLabel.trim(), order: pages.length * 10 }),
    });
    const data = await r.json();
    if (!r.ok) { setAddError(data.error ?? "Failed"); setAddSaving(false); return; }
    setPages(prev => [...prev, data].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)));
    setNewPath(""); setNewLabel(""); setAddSaving(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const inp = "border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30";

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">Site Pages</h1>
      <p className="text-slate-400 text-sm mb-8">
        All pages registered here appear as options when setting CTA button URLs in Content.
        Add future pages now so they're available to select before they're built.
      </p>

      {/* Page list */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto mb-6">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 grid grid-cols-[1fr_1fr_auto] gap-4">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Label</span>
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Path</span>
          <span />
        </div>

        {pages.length === 0 && (
          <p className="px-5 py-6 text-slate-400 text-sm">No pages yet.</p>
        )}

        <div className="divide-y divide-slate-100">
          {pages.map(p => (
            <div key={p.id} className="px-5 py-3 grid grid-cols-[1fr_1fr_auto] gap-4 items-center">
              {editing === p.id ? (
                <>
                  <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                    className={inp + " w-full"} autoFocus />
                  <input value={editPath} onChange={e => setEditPath(e.target.value)}
                    className={inp + " w-full font-mono"} />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(p.id)} disabled={saving === p.id}
                      className="text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap">
                      {saving === p.id ? "…" : "Save"}
                    </button>
                    <button onClick={() => setEditing(null)} className="text-xs text-slate-400 hover:text-slate-600">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-navy text-sm font-medium">{p.label}</p>
                  <Link href={p.path} target="_blank"
                    className="text-slate-500 text-sm font-mono hover:text-brand hover:underline transition-colors">
                    {p.path}
                  </Link>
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(p)} className="text-brand text-xs hover:underline">Edit</button>
                    <button onClick={() => deletePage(p.id, p.label)} disabled={deleting === p.id}
                      className="text-slate-400 hover:text-red-500 text-xs transition-colors disabled:opacity-50">
                      {deleting === p.id ? "…" : "Delete"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add new page */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="text-navy font-semibold text-sm mb-4">Add a page</h2>
        <form onSubmit={addPage} className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="text-slate-400 text-xs mb-1 block">Label</label>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              placeholder="e.g. Grading Guide"
              className={inp + " w-full"} />
          </div>
          <div className="flex-1 min-w-40">
            <label className="text-slate-400 text-xs mb-1 block">Path</label>
            <input value={newPath} onChange={e => setNewPath(e.target.value)}
              placeholder="e.g. /grading"
              className={inp + " w-full font-mono"} />
          </div>
          <button type="submit" disabled={addSaving || !newLabel || !newPath}
            className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap">
            {addSaving ? "Adding…" : "Add page"}
          </button>
        </form>
        {addError && <p className="text-red-500 text-xs mt-2">{addError}</p>}
        <p className="text-slate-400 text-xs mt-3">
          The leading slash is added automatically if you forget it.
          Add planned pages now — they'll appear as options in Content before they're built.
        </p>
      </div>
    </div>
  );
}

