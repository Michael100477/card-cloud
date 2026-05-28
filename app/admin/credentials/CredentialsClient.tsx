"use client";

import { useState } from "react";
import type { GroupData, CredItem, EbayEnvStatus } from "./page";

interface Props {
  groups:        GroupData[];
  allGroupNames: string[];
  ebayStatus?:   { sandbox: EbayEnvStatus; production: EbayEnvStatus };
  successMsg?:   string;
  errorMsg?:     string;
}

export function CredentialsClient({ groups: initialGroups, allGroupNames: initialGroupNames, ebayStatus, successMsg, errorMsg }: Props) {
  const [groups,     setGroups]     = useState(initialGroups);
  const [groupNames, setGroupNames] = useState(initialGroupNames);

  // Per-item edit state
  const [editing,  setEditing]  = useState<Record<string, boolean>>({});
  const [draft,    setDraft]    = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState<string | null>(null);
  const [saved,    setSaved]    = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  // Add form
  const [showAdd,   setShowAdd]   = useState(false);
  const [newLabel,  setNewLabel]  = useState("");
  const [newSvc,    setNewSvc]    = useState("");
  const [newVal,    setNewVal]    = useState("");
  const [newGroup,  setNewGroup]  = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError,  setAddError]  = useState("");

  // ── Edit / save ───────────────────────────────────────────────────────────

  function startEdit(service: string, current: string) {
    setDraft(d => ({ ...d, [service]: current }));
    setEditing(e => ({ ...e, [service]: true }));
  }
  function cancelEdit(service: string) {
    setEditing(e => ({ ...e, [service]: false }));
  }

  async function saveEdit(service: string, label: string) {
    setSaving(service);
    await fetch("/api/admin/credentials", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service, label, value: draft[service] ?? "" }),
    });
    // Update value in local state
    setGroups(prev => prev.map(g => ({
      ...g,
      items: g.items.map(i => i.service === service ? { ...i, value: draft[service] ?? "" } : i),
    })));
    setEditing(e => ({ ...e, [service]: false }));
    setSaved(s => ({ ...s, [service]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [service]: false })), 2000);
    setSaving(null);
  }

  // ── Delete entire row ─────────────────────────────────────────────────────

  async function deleteRow(service: string, label: string) {
    if (!confirm(`Remove "${label}" from this category? This cannot be undone.`)) return;
    setDeleting(service);
    await fetch("/api/admin/credentials", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service }),
    });
    // Remove the item from its group; remove the group if now empty
    setGroups(prev =>
      prev
        .map(g => ({ ...g, items: g.items.filter(i => i.service !== service) }))
        .filter(g => g.items.length > 0)
    );
    setDeleting(null);
  }

  // ── Add new credential ────────────────────────────────────────────────────

  async function addCredential(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !newSvc.trim() || !newGroup.trim()) {
      setAddError("Label, service key, and category are all required."); return;
    }
    if (!/^[a-z0-9_]+$/.test(newSvc)) {
      setAddError("Service key: lowercase letters, numbers, and underscores only."); return;
    }
    setAddSaving(true); setAddError("");

    const r = await fetch("/api/admin/credentials", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: newSvc, label: newLabel, value: newVal, group: newGroup }),
    });
    if (!r.ok) {
      setAddError((await r.json()).error ?? "Failed to save");
      setAddSaving(false); return;
    }

    const newItem: CredItem = { service: newSvc, label: newLabel, value: newVal };
    setGroups(prev => {
      const exists = prev.find(g => g.name === newGroup);
      if (exists) return prev.map(g => g.name === newGroup ? { ...g, items: [...g.items, newItem] } : g);
      return [...prev, { name: newGroup, items: [newItem] }];
    });
    if (!groupNames.includes(newGroup)) setGroupNames(g => [...g, newGroup]);

    setNewLabel(""); setNewSvc(""); setNewVal(""); setNewGroup("");
    setShowAdd(false); setAddSaving(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function mask(val: string) {
    if (!val) return "—";
    if (val.length <= 8) return "••••••••";
    return val.slice(0, 4) + "••••••••" + val.slice(-4);
  }

  return (
    <div className="p-8">
      {/* eBay OAuth flash messages */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-5 py-3 text-sm mb-6">{successMsg}</div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm mb-6">{errorMsg}</div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">API Keys & Credentials</h1>
          <p className="text-slate-400 text-sm">All entries are fully manageable — set, edit, or remove any key.</p>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setAddError(""); }}
          className="bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-600 transition-colors shrink-0"
        >
          {showAdd ? "Cancel" : "+ Add API key"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={addCredential}
          className="bg-white rounded-2xl border border-brand/30 p-6 mb-6 flex flex-col gap-4">
          <p className="text-navy font-semibold">New API key</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Label</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                placeholder="e.g. Shippo API Key"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">
                Service key <span className="text-slate-300">(lowercase + underscores)</span>
              </label>
              <input
                value={newSvc}
                onChange={e => setNewSvc(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                placeholder="e.g. shippo_api_key"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Value <span className="text-slate-300">(optional — can set later)</span></label>
              <input value={newVal} onChange={e => setNewVal(e.target.value)}
                placeholder="Paste your API key or secret"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-navy focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">
                Category <span className="text-slate-300">(pick existing or type a new one)</span>
              </label>
              <input
                value={newGroup} onChange={e => setNewGroup(e.target.value)}
                list="group-datalist" placeholder="e.g. Shipping"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <datalist id="group-datalist">
                {groupNames.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>
          </div>

          {addError && <p className="text-red-500 text-xs">{addError}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={addSaving || !newLabel || !newSvc || !newGroup}
              className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-600 disabled:opacity-50">
              {addSaving ? "Saving…" : "Save key"}
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setAddError(""); }}
              className="text-slate-400 text-sm hover:text-slate-600 px-3">Cancel</button>
          </div>
        </form>
      )}

      {/* Groups */}
      <div className="flex flex-col gap-6">
        {groups.map(group => (
          <div key={group.name} className={`bg-white rounded-2xl border overflow-hidden ${group.activeEnvGroup ? "border-brand/40 ring-1 ring-brand/20" : "border-slate-100"}`}>
            <div className={`px-5 py-3.5 border-b ${group.activeEnvGroup ? "bg-brand/5 border-brand/20" : "bg-slate-50 border-slate-100"}`}>
              <div className="flex items-center gap-2">
                <h2 className="text-navy font-semibold text-sm">{group.name}</h2>
                {group.activeEnvGroup && (
                  <span className="text-xs bg-brand text-white px-2 py-0.5 rounded-full font-medium">Active</span>
                )}
                {(group.name === "eBay — Sandbox" || group.name === "eBay — Production") && !group.activeEnvGroup && (
                  <span className="text-xs text-slate-400">(inactive — change Environment in Marketplace — eBay to switch)</span>
                )}
              </div>
            </div>
            {/* eBay connect panel — shown at the top of each eBay env group */}
            {(group.name === "eBay — Sandbox" || group.name === "eBay — Production") && ebayStatus && (() => {
              const isProduction = group.name === "eBay — Production";
              const envKey = isProduction ? "production" : "sandbox";
              const status = ebayStatus[envKey];
              const connectUrl = `/api/ebay/authorize?env=${envKey}`;
              return (
                <div className={`px-5 py-4 flex items-center justify-between gap-4 border-b ${status.connected ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100"}`}>
                  <div>
                    {status.connected ? (
                      <>
                        <p className="text-green-800 font-semibold text-sm">● Connected</p>
                        {status.seller && <p className="text-green-700 text-xs font-mono mt-0.5">Seller: {status.seller}</p>}
                        {status.expiresAt && (
                          <p className="text-green-600 text-xs mt-0.5">
                            Token refreshes automatically · next refresh around{" "}
                            {new Date(status.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-amber-700 text-sm">○ Not connected — enter App ID, Cert ID, and RuName below, then click Connect.</p>
                    )}
                  </div>
                  <a href={connectUrl}
                    className={`shrink-0 text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${
                      status.connected
                        ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        : "bg-amber-500 text-white hover:bg-amber-600"
                    }`}
                  >
                    {status.connected ? "Reconnect eBay account" : "Connect eBay account"}
                  </a>
                </div>
              );
            })()}

            <div className="divide-y divide-slate-100">
              {group.items.map(item => {
                const isEditing  = !!editing[item.service];
                const hasValue   = !!item.value;
                const isSaving   = saving  === item.service;
                const isDeleting = deleting === item.service;

                return (
                  <div key={item.service} className="px-5 py-3.5 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-navy text-sm font-medium">{item.label}</p>
                        {item.auto && (
                          <span className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">auto</span>
                        )}
                        {hasValue && !isEditing && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">set</span>
                        )}
                        {saved[item.service] && <span className="text-xs text-green-600">✓ Saved</span>}
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2 mt-1.5">
                          {item.service === "ebay_environment" ? (
                            <select
                              value={draft[item.service] ?? "sandbox"}
                              onChange={e => setDraft(d => ({ ...d, [item.service]: e.target.value }))}
                              autoFocus
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
                            >
                              <option value="sandbox">sandbox</option>
                              <option value="production">production</option>
                            </select>
                          ) : (
                          <input
                            type="text"
                            value={draft[item.service] ?? ""}
                            onChange={e => setDraft(d => ({ ...d, [item.service]: e.target.value }))}
                            placeholder={item.hint ?? "Paste value…"}
                            autoFocus
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
                          />
                          )}
                          <button onClick={() => saveEdit(item.service, item.label)} disabled={isSaving}
                            className="bg-brand text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50 shrink-0">
                            {isSaving ? "Saving…" : "Save"}
                          </button>
                          <button onClick={() => cancelEdit(item.service)}
                            className="text-slate-400 text-xs hover:text-slate-600 shrink-0">Cancel</button>
                        </div>
                      ) : (
                        <p className="text-slate-400 text-xs font-mono mt-0.5">{mask(item.value)}</p>
                      )}
                    </div>

                    {/* Set + Delete — always visible */}
                    {!isEditing && (
                      <div className="flex items-center gap-3 shrink-0 mt-0.5">
                        <button onClick={() => startEdit(item.service, item.value)}
                          className="text-brand text-xs font-medium hover:underline">
                          {hasValue ? "Edit" : "Set"}
                        </button>
                        <button
                          onClick={() => deleteRow(item.service, item.label)}
                          disabled={isDeleting}
                          className="text-slate-400 hover:text-red-500 text-xs transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? "…" : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
