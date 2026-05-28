"use client";

import { useState } from "react";
import { HowToBlockEditor } from "@/components/admin/HowToBlockEditor";
import { FaqEditor } from "@/components/admin/FaqEditor";
import { TermsSectionEditor } from "@/components/admin/TermsSectionEditor";
import { PrivacySectionEditor } from "@/components/admin/PrivacySectionEditor";

interface Slot     { key: string; label: string; defaultValue: string; multiline: boolean; type?: string; showKey?: string; showDefault?: string }
interface Section  { section: string; slots: Slot[] }
interface SitePage { id: string; path: string; label: string }

interface Props {
  sections:  Section[];
  valueMap:  Record<string, string>;
  sitePages: SitePage[];
}

export function ContentClient({ sections, valueMap, sitePages }: Props) {
  const [values, setValues] = useState<Record<string, string>>(valueMap);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved,  setSaved]  = useState<Record<string, boolean>>({});
  const [subTab, setSubTab] = useState<"other" | "services" | "howto" | "support" | "faq" | "terms" | "privacy" | "pricing">("other");

  const isHowTo = (name: string) => name.startsWith("How It Works") || name.startsWith("How To");
  const howToSections    = sections.filter(s => isHowTo(s.section));
  const servicesSections = sections.filter(s => s.section.startsWith("Service card"));
  const supportSections  = sections.filter(s => s.section === "Support page");
  const faqSections      = sections.filter(s => s.section === "FAQ page");
  const termsSections    = sections.filter(s => s.section === "Terms of Service page");
  const privacySections  = sections.filter(s => s.section === "Privacy Policy page");
  const pricingSections  = sections.filter(s => s.section === "Pricing section (landing page)" || s.section === "Pricing page");
  const otherSections    = sections.filter(s =>
    !isHowTo(s.section) &&
    !s.section.startsWith("Service card") &&
    s.section !== "Support page" &&
    s.section !== "FAQ page" &&
    s.section !== "Terms of Service page" &&
    s.section !== "Privacy Policy page" &&
    s.section !== "Pricing section (landing page)" &&
    s.section !== "Pricing page"
  );

  async function save(key: string) {
    setSaving(key);
    await fetch("/api/admin/content", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: values[key] ?? "" }),
    });
    setSaved(s => ({ ...s, [key]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2000);
    setSaving(null);
  }

  const inp = "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30";

  const activeSections =
    subTab === "howto"    ? howToSections    :
    subTab === "services" ? servicesSections :
    subTab === "support"  ? supportSections  :
    subTab === "faq"      ? faqSections      :
    subTab === "terms"    ? termsSections    :
    subTab === "privacy"  ? privacySections  :
    subTab === "pricing"  ? pricingSections  :
    otherSections;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-navy mb-1">Content</h1>
      <p className="text-slate-400 text-sm mb-6">
        Edit landing page copy. Changes are live immediately — no deploy needed.
      </p>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-200 p-1 rounded-xl mb-6 w-fit">
        {(["other", "services", "howto", "pricing", "support", "faq", "terms", "privacy"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${subTab === t ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
            {t === "howto" ? "How To" : t === "services" ? "Service Cards" : t === "support" ? "Support Page" : t === "faq" ? "FAQ Page" : t === "terms" ? "Terms" : t === "privacy" ? "Privacy" : t === "pricing" ? "Pricing" : "Landing Page"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {activeSections.map(s => (
          <div key={s.section} className="bg-white rounded-2xl border border-slate-100">
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <h2 className="text-navy font-semibold text-sm">{s.section}</h2>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 gap-5">
              {s.slots.map(slot => {
                const current = values[slot.key] ?? "";
                const changed = current !== (valueMap[slot.key] ?? "");
                const isUrl    = slot.type === "url";
                const isBlocks = slot.type === "blocks";
                const isFaq    = slot.type === "faq";
                const isTerms   = slot.type === "terms-sections";
                const isPrivacy = slot.type === "privacy-sections";
                const isToggle  = slot.type === "toggle";
                const isStatRow = slot.type === "stat-row";

                // Stat row — input/textarea + on/off toggle + save
                if (isStatRow && slot.showKey) {
                  const labelCurrent = values[slot.key] ?? slot.defaultValue ?? "";
                  const labelChanged = labelCurrent !== (valueMap[slot.key] ?? slot.defaultValue ?? "");
                  const on = (values[slot.showKey] ?? slot.showDefault ?? "yes") !== "no";
                  const toggleSave = async () => {
                    const next = on ? "no" : "yes";
                    setValues(prev => ({ ...prev, [slot.showKey!]: next }));
                    setSaving(slot.showKey!);
                    await fetch("/api/admin/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: slot.showKey, value: next }) });
                    setSaved(s => ({ ...s, [slot.showKey!]: true }));
                    setTimeout(() => setSaved(s => ({ ...s, [slot.showKey!]: false })), 2000);
                    setSaving(null);
                  };
                  if (slot.multiline) {
                    // Multiline: textarea full-width, toggle + save on row below
                    return (
                      <div key={slot.key}>
                        <label className="text-navy text-xs font-semibold uppercase tracking-wide block mb-1.5">{slot.label}</label>
                        <textarea
                          value={labelCurrent}
                          onChange={e => setValues(prev => ({ ...prev, [slot.key]: e.target.value }))}
                          placeholder={slot.defaultValue}
                          rows={3}
                          className={`${inp} resize-y`}
                        />
                        <div className="flex items-center justify-end gap-2 mt-1.5">
                          {saved[slot.showKey] && <span className="text-xs text-green-600 shrink-0">✓</span>}
                          <Toggle on={on} onToggle={toggleSave} />
                          <button onClick={() => save(slot.key)} disabled={saving === slot.key || !labelChanged}
                            className="bg-brand text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-40 shrink-0">
                            {saving === slot.key ? "Saving…" : "Save"}
                          </button>
                          {saved[slot.key] && <span className="text-xs text-green-600">✓ Saved</span>}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={slot.key}>
                      <label className="text-navy text-xs font-semibold uppercase tracking-wide block mb-1.5">{slot.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          value={labelCurrent}
                          onChange={e => setValues(prev => ({ ...prev, [slot.key]: e.target.value }))}
                          placeholder={slot.defaultValue}
                          className={`${inp} flex-1`}
                        />
                        <Toggle on={on} onToggle={toggleSave} />
                        {saved[slot.showKey] && <span className="text-xs text-green-600 shrink-0">✓</span>}
                        <button onClick={() => save(slot.key)} disabled={saving === slot.key || !labelChanged}
                          className="bg-brand text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-40 shrink-0">
                          {saving === slot.key ? "Saving…" : "Save"}
                        </button>
                        {saved[slot.key] && <span className="text-xs text-green-600">✓ Saved</span>}
                      </div>
                    </div>
                  );
                }

                // Standalone toggle — for section-level on/off (e.g. "Show stats section")
                if (isToggle) {
                  const on = (values[slot.key] ?? slot.defaultValue ?? "yes") !== "no";
                  return (
                    <div key={slot.key} className="flex items-center justify-between">
                      <label className="text-navy text-xs font-semibold uppercase tracking-wide pr-4">{slot.label}</label>
                      <div className="flex items-center shrink-0">
                        {saved[slot.key] && <span className="text-xs text-green-600 mr-1">✓</span>}
                        <Toggle on={on} onToggle={async () => {
                            const next = on ? "no" : "yes";
                            setValues(prev => ({ ...prev, [slot.key]: next }));
                            setSaving(slot.key);
                            await fetch("/api/admin/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: slot.key, value: next }) });
                            setSaved(s => ({ ...s, [slot.key]: true }));
                            setTimeout(() => setSaved(s => ({ ...s, [slot.key]: false })), 2000);
                            setSaving(null);
                          }} />
                      </div>
                    </div>
                  );
                }

                // FAQ editor
                if (isFaq) return (
                  <div key={slot.key}>
                    <label className="text-navy text-xs font-semibold uppercase tracking-wide block mb-2">
                      {slot.label}
                    </label>
                    <FaqEditor faqKey={slot.key} initialValue={valueMap[slot.key] ?? "[]"} />
                  </div>
                );

                // Terms section editor
                if (isTerms) return (
                  <div key={slot.key}>
                    <label className="text-navy text-xs font-semibold uppercase tracking-wide block mb-2">
                      {slot.label}
                    </label>
                    <p className="text-slate-400 text-xs mb-3">Edit any section below. Changes save automatically on blur.</p>
                    <TermsSectionEditor termsKey={slot.key} initialValue={valueMap[slot.key] ?? "[]"} />
                  </div>
                );

                // Privacy section editor
                if (isPrivacy) return (
                  <div key={slot.key}>
                    <label className="text-navy text-xs font-semibold uppercase tracking-wide block mb-2">
                      {slot.label}
                    </label>
                    <p className="text-slate-400 text-xs mb-3">Edit any section below. Changes save automatically on blur.</p>
                    <PrivacySectionEditor privacyKey={slot.key} initialValue={valueMap[slot.key] ?? "[]"} />
                  </div>
                );

                // Block editor — unified text + image + video content builder
                if (isBlocks) return (
                  <div key={slot.key}>
                    <label className="text-navy text-xs font-semibold uppercase tracking-wide block mb-2">
                      {slot.label}
                    </label>
                    <HowToBlockEditor
                      blocksKey={slot.key}
                      initialValue={valueMap[slot.key] ?? "[]"}
                    />
                  </div>
                );

                return (
                  <div key={slot.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <label className="text-navy text-xs font-semibold uppercase tracking-wide">
                          {slot.label}
                        </label>
                        {isUrl && (
                          <span className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">URL</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {changed && <span className="text-xs text-amber-500">unsaved</span>}
                        {saved[slot.key] && <span className="text-xs text-green-600">✓ Saved</span>}
                        <button
                          onClick={() => save(slot.key)}
                          disabled={saving === slot.key || !changed}
                          className="bg-brand text-white text-xs font-semibold px-3 py-1 rounded-lg hover:bg-blue-600 disabled:opacity-40"
                        >
                          {saving === slot.key ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>

                    {isUrl ? (
                      <UrlField
                        value={current}
                        onChange={v => setValues(prev => ({ ...prev, [slot.key]: v }))}
                        defaultValue={slot.defaultValue}
                        sitePages={sitePages}
                      />
                    ) : slot.multiline ? (
                      <textarea
                        rows={3}
                        value={current}
                        onChange={e => setValues(v => ({ ...v, [slot.key]: e.target.value }))}
                        placeholder={slot.defaultValue}
                        className={inp + " resize-none"}
                      />
                    ) : (
                      <input
                        type="text"
                        value={current}
                        onChange={e => setValues(v => ({ ...v, [slot.key]: e.target.value }))}
                        placeholder={slot.defaultValue}
                        className={inp}
                      />
                    )}

                    {!isUrl && (
                      <p className="text-slate-400 text-xs mt-1">Default: {slot.defaultValue}</p>
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

// ── URL field: site page picker + custom URL fallback ─────────────────────────

// ── Toggle — text lives INSIDE the button so nothing external can ever clip it ─
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative flex items-center h-7 w-16 rounded-full transition-colors shrink-0 select-none ${on ? "bg-green-500" : "bg-slate-300"}`}
    >
      {/* Label text — always on the opposite side from the circle */}
      <span className={`absolute text-[11px] font-bold text-white transition-all ${on ? "left-2.5" : "right-2"}`}>
        {on ? "On" : "Off"}
      </span>
      {/* Sliding circle */}
      <span className={`absolute w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${on ? "translate-x-9" : "translate-x-1"}`} />
    </button>
  );
}

const CUSTOM = "__custom__";

function UrlField({
  value, onChange, defaultValue, sitePages,
}: {
  value:        string;
  onChange:     (v: string) => void;
  defaultValue: string;
  sitePages:    SitePage[];
}) {
  const knownPaths = new Set(sitePages.map(p => p.path));
  const isKnown    = value === "" || knownPaths.has(value);
  const [mode, setMode] = useState<"page" | "custom">(isKnown ? "page" : "custom");

  function handleSelectChange(selected: string) {
    if (selected === CUSTOM) {
      setMode("custom");
      onChange("");
    } else {
      setMode("page");
      onChange(selected);
    }
  }

  const selectCls = "flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30";
  const inputCls  = "flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-navy focus:outline-none focus:ring-2 focus:ring-brand/30 placeholder-slate-400";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {/* Page selector */}
        <select
          value={mode === "custom" ? CUSTOM : (value || "")}
          onChange={e => handleSelectChange(e.target.value)}
          className={selectCls}
        >
          <option value="">— Select a page —</option>
          {sitePages.map(p => (
            <option key={p.id} value={p.path}>
              {p.label} — {p.path}
            </option>
          ))}
          <option value={CUSTOM}>Custom URL…</option>
        </select>
      </div>

      {/* Custom URL input — shown when "Custom URL…" is selected */}
      {mode === "custom" && (
        <div className="flex gap-2 items-center">
          <input
            type="url"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="https://example.com or /path"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => { setMode("page"); onChange(""); }}
            className="text-xs text-slate-400 hover:text-slate-600 whitespace-nowrap"
          >
            ← Pick a page
          </button>
        </div>
      )}

      <p className="text-slate-400 text-xs">
        {mode === "custom"
          ? "Enter any URL. To link to a page not in the list, add it under Admin → Pages first."
          : <>Default: <span className="font-mono">{defaultValue}</span> · To use an external URL, choose "Custom URL…"</>
        }
      </p>
    </div>
  );
}
