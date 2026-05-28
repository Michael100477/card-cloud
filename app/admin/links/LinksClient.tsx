"use client";

import { useState } from "react";

interface SiteLink { id: string; key: string; section: string; label: string; href: string; enabled: boolean; order: number }
interface SitePage  { id: string; path: string; label: string }

interface Props {
  initialLinks: SiteLink[];
  sitePages:    SitePage[];
  sectionOrder: string[];
}

const CUSTOM = "__custom__";

export function LinksClient({ initialLinks, sitePages, sectionOrder }: Props) {
  const [links,    setLinks]    = useState(initialLinks);
  const [editing,  setEditing]  = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<SiteLink>>({});
  const [saving,   setSaving]   = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Top-level add form
  const [showAdd,   setShowAdd]   = useState(false);
  const [newKey,    setNewKey]    = useState("");
  const [newSection,setNewSection]= useState("");
  const [newLabel,  setNewLabel]  = useState("");
  const [newHref,   setNewHref]   = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError,  setAddError]  = useState("");

  // Inline per-section add form
  const [inlineSection, setInlineSection] = useState<string | null>(null);
  const [inlineLabel,   setInlineLabel]   = useState("");
  const [inlineHref,    setInlineHref]    = useState("");
  const [inlineSaving,  setInlineSaving]  = useState(false);
  const [inlineError,   setInlineError]   = useState("");

  function openInline(section: string) {
    setInlineSection(section);
    setInlineLabel("");
    setInlineHref("");
    setInlineError("");
  }

  async function submitInline(section: string) {
    if (!inlineLabel || !inlineHref) { setInlineError("Label and URL are required."); return; }
    const slug = inlineLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const sectionSlug = section.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const key = `${sectionSlug}_${slug}_${Math.random().toString(36).slice(2, 6)}`;
    setInlineSaving(true);
    const r = await fetch("/api/admin/links", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, section, label: inlineLabel, href: inlineHref }),
    });
    const data = await r.json();
    if (!r.ok) { setInlineError(data.error ?? "Failed to add."); setInlineSaving(false); return; }
    setLinks(prev => [...prev, data].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)));
    setInlineSection(null);
    setInlineSaving(false);
  }

  const knownPaths = new Set(sitePages.map(p => p.path));

  // ── Toggle enabled ────────────────────────────────────────────────────────

  async function toggleEnabled(link: SiteLink) {
    setToggling(link.id);
    const r = await fetch(`/api/admin/links/${link.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !link.enabled }),
    });
    if (r.ok) {
      const updated = await r.json();
      setLinks(prev => prev.map(l => l.id === link.id ? updated : l));
    }
    setToggling(null);
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  function startEdit(link: SiteLink) {
    setEditing(link.id);
    setEditData({ label: link.label, href: link.href });
  }

  async function saveEdit(id: string) {
    setSaving(id);
    const r = await fetch(`/api/admin/links/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    if (r.ok) {
      const updated = await r.json();
      setLinks(prev => prev.map(l => l.id === id ? updated : l));
      setEditing(null);
    }
    setSaving(null);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function deleteLink(id: string, label: string) {
    if (!confirm(`Remove "${label}"? This cannot be undone.`)) return;
    setDeleting(id);
    await fetch(`/api/admin/links/${id}`, { method: "DELETE" });
    setLinks(prev => prev.filter(l => l.id !== id));
    setDeleting(null);
  }

  // ── Add ───────────────────────────────────────────────────────────────────

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!newKey || !newSection || !newLabel || !newHref) {
      setAddError("All fields except value are required."); return;
    }
    if (!/^[a-z0-9_]+$/.test(newKey)) {
      setAddError("Key: lowercase letters, numbers, and underscores only."); return;
    }
    setAddSaving(true); setAddError("");
    const r = await fetch("/api/admin/links", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newKey, section: newSection, label: newLabel, href: newHref }),
    });
    const data = await r.json();
    if (!r.ok) { setAddError(data.error ?? "Failed"); setAddSaving(false); return; }
    setLinks(prev => [...prev, data].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)));
    setNewKey(""); setNewSection(""); setNewLabel(""); setNewHref(""); setShowAdd(false); setAddSaving(false);
  }

  // ── Group by section in canonical order ───────────────────────────────────

  const groupMap = new Map<string, SiteLink[]>();
  for (const l of links) {
    if (!groupMap.has(l.section)) groupMap.set(l.section, []);
    groupMap.get(l.section)!.push(l);
  }
  const allSections = [
    ...sectionOrder.filter(s => groupMap.has(s)),
    ...[...groupMap.keys()].filter(s => !sectionOrder.includes(s)).sort(),
  ];

  const inp = "border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30";

  // ── URL picker (reused in edit + add forms) ────────────────────────────────

  function UrlPicker({ value, onChange, inputCls, initialMode }: { value: string; onChange: (v: string) => void; inputCls?: string; initialMode?: "page" | "custom" }) {
    const isKnown = value === "" || knownPaths.has(value);
    const [mode, setMode] = useState<"page" | "custom">(initialMode ?? (isKnown ? "page" : "custom"));

    if (mode === "custom") {
      return (
        <div className="flex gap-1.5 items-center">
          <input type="url" value={value} onChange={e => onChange(e.target.value)}
            placeholder="https://instagram.com/yourhandle"
            className={(inputCls ?? inp) + " flex-1 font-mono"} />
          <button type="button" onClick={() => { setMode("page"); onChange(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 whitespace-nowrap">← Site page</button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        <select
          value={value || ""}
          onChange={e => {
            if (e.target.value === CUSTOM) { setMode("custom"); onChange(""); }
            else { onChange(e.target.value); }
          }}
          className={inputCls ?? inp}
        >
          <option value="">— Select a page —</option>
          {sitePages.map(p => <option key={p.id} value={p.path}>{p.label} — {p.path}</option>)}
          <option value={CUSTOM}>External URL…</option>
        </select>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">Links & Buttons</h1>
          <p className="text-slate-400 text-sm">
            Every link and button on the site. Toggle to show/hide. Edit text and destination. Disabled links disappear from the page entirely.
          </p>
        </div>
        <button onClick={() => { setShowAdd(v => !v); setAddError(""); }}
          className="bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-600 transition-colors shrink-0">
          {showAdd ? "Cancel" : "+ Add link"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={addLink} className="bg-white rounded-2xl border border-brand/30 p-6 mb-6 flex flex-col gap-4">
          <p className="text-navy font-semibold">New link or button</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Label (display text)</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Learn More"
                className={inp + " w-full"} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Section</label>
              <input value={newSection} onChange={e => setNewSection(e.target.value)} list="section-list"
                placeholder="e.g. Navigation"
                className={inp + " w-full"} />
              <datalist id="section-list">
                {allSections.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">URL</label>
              <UrlPicker value={newHref} onChange={setNewHref} inputCls={inp + " w-full"} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Key <span className="text-slate-300">(unique identifier)</span></label>
              <input value={newKey} onChange={e => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                placeholder="e.g. nav_learn_more" className={inp + " w-full font-mono"} />
            </div>
          </div>
          {addError && <p className="text-red-500 text-xs">{addError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={addSaving || !newLabel || !newSection || !newHref || !newKey}
              className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-600 disabled:opacity-50">
              {addSaving ? "Saving…" : "Add link"}
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setAddError(""); }}
              className="text-slate-400 text-sm hover:text-slate-600 px-3">Cancel</button>
          </div>
        </form>
      )}

      {/* Sections */}
      <div className="flex flex-col gap-6">
        {allSections.map(section => (
          <div key={section} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100">
              <h2 className="text-navy font-semibold text-sm">{section}</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {(groupMap.get(section) ?? []).map(link => (
                <div key={link.id} className="px-5 py-3.5">
                  {editing === link.id ? (
                    <div className="flex flex-col gap-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">Label</label>
                          <input value={editData.label ?? ""} onChange={e => setEditData(d => ({ ...d, label: e.target.value }))}
                            className={inp + " w-full"} autoFocus />
                        </div>
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">URL</label>
                          <UrlPicker
                            value={editData.href ?? ""}
                            onChange={v => setEditData(d => ({ ...d, href: v }))}
                            initialMode={link.section === "Social Media" ? "custom" : undefined}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(link.id)} disabled={saving === link.id}
                          className="bg-brand text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50">
                          {saving === link.id ? "Saving…" : "Save"}
                        </button>
                        <button onClick={() => setEditing(null)} className="text-slate-400 text-xs hover:text-slate-600">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      {/* Toggle */}
                      <button
                        onClick={() => toggleEnabled(link)}
                        disabled={toggling === link.id}
                        title={link.enabled ? "Visible — click to hide" : "Hidden — click to show"}
                        className={`w-9 h-5 rounded-full relative transition-colors shrink-0 disabled:opacity-50 ${link.enabled ? "bg-green-500" : "bg-slate-200"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${link.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${link.enabled ? "text-navy" : "text-slate-400 line-through"}`}>
                          {link.label}
                        </p>
                        <p className="text-slate-400 text-xs font-mono truncate">{link.href}</p>
                      </div>

                      {/* Key badge */}
                      <span className="text-slate-300 text-xs font-mono hidden lg:block shrink-0">{link.key}</span>

                      {/* Actions */}
                      <div className="flex gap-3 shrink-0">
                        <button onClick={() => startEdit(link)} className="text-brand text-xs hover:underline">Edit</button>
                        <button onClick={() => deleteLink(link.id, link.label)} disabled={deleting === link.id}
                          className="text-slate-400 hover:text-red-500 text-xs transition-colors disabled:opacity-50">
                          {deleting === link.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Inline add row */}
              {inlineSection === section ? (
                <div className="px-5 py-4 bg-slate-50/70">
                  <div className="flex flex-col gap-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Label</label>
                        <input
                          value={inlineLabel}
                          onChange={e => setInlineLabel(e.target.value)}
                          placeholder="Link text"
                          autoFocus
                          className={inp + " w-full"}
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">URL</label>
                        <UrlPicker
                          value={inlineHref}
                          onChange={setInlineHref}
                          initialMode={inlineSection === "Social Media" ? "custom" : undefined}
                        />
                      </div>
                    </div>
                    {inlineError && <p className="text-red-500 text-xs">{inlineError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitInline(section)}
                        disabled={inlineSaving || !inlineLabel || !inlineHref}
                        className="bg-brand text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50"
                      >
                        {inlineSaving ? "Adding…" : "Add link"}
                      </button>
                      <button onClick={() => setInlineSection(null)} className="text-slate-400 text-xs hover:text-slate-600">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-2.5">
                  <button
                    onClick={() => openInline(section)}
                    className="text-xs text-slate-400 hover:text-brand transition-colors flex items-center gap-1"
                  >
                    <span className="text-base leading-none">+</span> Add item to this section
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
