"use client";

import { useState, useRef } from "react";

interface MediaItem {
  type: "image" | "video";
  url: string;
  caption: string;
}

interface Props {
  mediaKey: string;
  initialValue: string; // JSON string
}

async function saveMedia(key: string, items: MediaItem[]) {
  await fetch("/api/admin/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value: JSON.stringify(items) }),
  });
}

export function HowToMediaEditor({ mediaKey, initialValue }: Props) {
  const [items, setItems] = useState<MediaItem[]>(() => {
    try { return JSON.parse(initialValue || "[]"); } catch { return []; }
  });
  const [uploading, setUploading] = useState(false);
  const [videoInput, setVideoInput] = useState("");
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function persist(updated: MediaItem[]) {
    setSaving(true);
    await saveMedia(mediaKey, updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const newItems: MediaItem[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (r.ok) {
        const d = await r.json();
        newItems.push({ type: "image", url: d.url, caption: "" });
      }
    }
    const updated = [...items, ...newItems];
    setItems(updated);
    await persist(updated);
    setUploading(false);
    e.target.value = "";
  }

  async function addVideo() {
    const url = videoInput.trim();
    if (!url) return;
    const updated = [...items, { type: "video" as const, url, caption: "" }];
    setItems(updated);
    await persist(updated);
    setVideoInput("");
    setShowVideoInput(false);
  }

  async function remove(idx: number) {
    const updated = items.filter((_, i) => i !== idx);
    setItems(updated);
    await persist(updated);
  }

  async function updateCaption(idx: number, caption: string) {
    const updated = items.map((item, i) => i === idx ? { ...item, caption } : item);
    setItems(updated);
  }

  async function saveCaption(idx: number) {
    await persist(items);
  }

  async function moveUp(idx: number) {
    if (idx === 0) return;
    const updated = [...items];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    setItems(updated);
    await persist(updated);
  }

  async function moveDown(idx: number) {
    if (idx === items.length - 1) return;
    const updated = [...items];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    setItems(updated);
    await persist(updated);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Media items */}
      {items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <div key={idx} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-start gap-3 p-3">
                {/* Thumbnail / video preview */}
                <div className="w-24 h-16 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                  {item.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-medium">
                      <span>▶ Video</span>
                    </div>
                  )}
                </div>

                {/* Info + controls */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-mono truncate mb-1">{item.url}</p>
                  <input
                    value={item.caption}
                    onChange={e => updateCaption(idx, e.target.value)}
                    onBlur={() => saveCaption(idx)}
                    placeholder="Caption (optional)"
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 text-navy focus:outline-none focus:ring-1 focus:ring-brand/30"
                  />
                </div>

                {/* Order + remove */}
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => moveUp(idx)} disabled={idx === 0}
                    className="text-slate-300 hover:text-navy disabled:opacity-20 text-xs leading-none px-1">↑</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === items.length - 1}
                    className="text-slate-300 hover:text-navy disabled:opacity-20 text-xs leading-none px-1">↓</button>
                  <button onClick={() => remove(idx)}
                    className="text-slate-300 hover:text-red-500 text-xs leading-none px-1 transition-colors">×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="text-slate-400 text-xs italic">No media added yet — upload a photo or add a video below.</p>
      )}

      {/* Add controls */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Upload photo */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs bg-brand text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "+ Upload photo"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />

        {/* Add video */}
        {!showVideoInput ? (
          <button
            onClick={() => setShowVideoInput(true)}
            className="flex items-center gap-1.5 text-xs border border-slate-300 text-slate-600 font-medium px-3 py-1.5 rounded-lg hover:border-brand hover:text-brand transition-colors"
          >
            + Add video
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <input
              value={videoInput}
              onChange={e => setVideoInput(e.target.value)}
              placeholder="https://www.youtube.com/embed/VIDEO_ID"
              className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
              onKeyDown={e => e.key === "Enter" && addVideo()}
              autoFocus
            />
            <button onClick={addVideo} className="text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 font-semibold">Add</button>
            <button onClick={() => { setShowVideoInput(false); setVideoInput(""); }} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
          </div>
        )}

        {saving && <span className="text-xs text-slate-400">Saving…</span>}
        {saved  && <span className="text-xs text-green-600">✓ Saved</span>}
      </div>
    </div>
  );
}
