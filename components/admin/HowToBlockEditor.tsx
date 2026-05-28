"use client";

import { useState, useRef, useCallback } from "react";

type BlockType = "text" | "image" | "video";

interface Block {
  id: string;
  type: BlockType;
  content: string;  // text content, image URL, or video embed URL
  caption: string;
}

interface Props {
  blocksKey: string;
  initialValue: string; // JSON string
}

function uid() { return Math.random().toString(36).slice(2, 9); }

async function persist(key: string, blocks: Block[]) {
  await fetch("/api/admin/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value: JSON.stringify(blocks) }),
  });
}

export function HowToBlockEditor({ blocksKey, initialValue }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => {
    try {
      const parsed = JSON.parse(initialValue || "[]");
      // Ensure every block has an id
      return parsed.map((b: Partial<Block>) => ({ id: uid(), caption: "", ...b }));
    } catch { return []; }
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [videoInput, setVideoInput] = useState("");
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = useCallback(async (updated: Block[]) => {
    setSaving(true);
    await persist(blocksKey, updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [blocksKey]);

  // ── Block operations ────────────────────────────────────────────────────

  function moveUp(idx: number) {
    if (idx === 0) return;
    const b = [...blocks];
    [b[idx - 1], b[idx]] = [b[idx], b[idx - 1]];
    setBlocks(b);
    save(b);
  }

  function moveDown(idx: number) {
    if (idx === blocks.length - 1) return;
    const b = [...blocks];
    [b[idx], b[idx + 1]] = [b[idx + 1], b[idx]];
    setBlocks(b);
    save(b);
  }

  function remove(idx: number) {
    const b = blocks.filter((_, i) => i !== idx);
    setBlocks(b);
    save(b);
  }

  function updateText(idx: number, content: string) {
    setBlocks(prev => prev.map((b, i) => i === idx ? { ...b, content } : b));
  }

  function updateCaption(idx: number, caption: string) {
    setBlocks(prev => prev.map((b, i) => i === idx ? { ...b, caption } : b));
  }

  function blurSave() { save(blocks); }

  function addTextBlock() {
    const b = [...blocks, { id: uid(), type: "text" as const, content: "", caption: "" }];
    setBlocks(b);
    save(b);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const newBlocks: Block[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (r.ok) {
        const d = await r.json();
        newBlocks.push({ id: uid(), type: "image", content: d.url, caption: "" });
      }
    }
    const b = [...blocks, ...newBlocks];
    setBlocks(b);
    await save(b);
    setUploading(false);
    e.target.value = "";
  }

  function addVideoBlock() {
    const url = videoInput.trim();
    if (!url) return;
    const b = [...blocks, { id: uid(), type: "video" as const, content: url, caption: "" }];
    setBlocks(b);
    save(b);
    setVideoInput("");
    setShowVideoInput(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* Block list */}
      {blocks.map((block, idx) => (
        <div key={block.id} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex gap-2 p-3">

            {/* Reorder + type badge */}
            <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
              <button onClick={() => moveUp(idx)} disabled={idx === 0}
                className="text-slate-300 hover:text-navy disabled:opacity-20 text-sm leading-none w-5 h-5 flex items-center justify-center">↑</button>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                block.type === "text"  ? "bg-brand/10 text-brand" :
                block.type === "image" ? "bg-green-100 text-green-700" :
                                         "bg-purple-100 text-purple-700"
              }`}>
                {block.type === "text" ? "T" : block.type === "image" ? "IMG" : "VID"}
              </span>
              <button onClick={() => moveDown(idx)} disabled={idx === blocks.length - 1}
                className="text-slate-300 hover:text-navy disabled:opacity-20 text-sm leading-none w-5 h-5 flex items-center justify-center">↓</button>
            </div>

            {/* Block content */}
            <div className="flex-1 min-w-0">
              {block.type === "text" && (
                <textarea
                  value={block.content}
                  onChange={e => updateText(idx, e.target.value)}
                  onBlur={blurSave}
                  placeholder="Write your text here… (leave a blank line between paragraphs)"
                  rows={4}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-navy focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y"
                />
              )}

              {block.type === "image" && (
                <div className="flex gap-3 items-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={block.content} alt="" className="w-20 h-14 object-cover rounded-lg border border-slate-200 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 font-mono truncate mb-1.5">{block.content}</p>
                    <input
                      value={block.caption}
                      onChange={e => updateCaption(idx, e.target.value)}
                      onBlur={blurSave}
                      placeholder="Caption (optional)"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-navy focus:outline-none focus:ring-1 focus:ring-brand/30"
                    />
                  </div>
                </div>
              )}

              {block.type === "video" && (
                <div className="flex gap-3 items-start">
                  <div className="w-20 h-14 bg-slate-200 rounded-lg shrink-0 flex items-center justify-center text-slate-400 text-xs font-medium">▶ Video</div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 font-mono truncate mb-1.5">{block.content}</p>
                    <input
                      value={block.caption}
                      onChange={e => updateCaption(idx, e.target.value)}
                      onBlur={blurSave}
                      placeholder="Caption (optional)"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-navy focus:outline-none focus:ring-1 focus:ring-brand/30"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Remove */}
            <button onClick={() => remove(idx)}
              className="text-slate-300 hover:text-red-500 text-lg leading-none shrink-0 transition-colors self-start">×</button>
          </div>
        </div>
      ))}

      {blocks.length === 0 && (
        <p className="text-slate-400 text-xs italic py-2">No content yet — add text, photos, or videos below.</p>
      )}

      {/* Add controls */}
      <div className="flex flex-wrap gap-2 items-center pt-1">
        <button onClick={addTextBlock}
          className="flex items-center gap-1.5 text-xs bg-brand text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-600">
          + Add text
        </button>

        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1.5 text-xs bg-green-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
          {uploading ? "Uploading…" : "+ Upload image"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />

        {!showVideoInput ? (
          <button onClick={() => setShowVideoInput(true)}
            className="flex items-center gap-1.5 text-xs bg-purple-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-purple-700">
            + Add video
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <input
              value={videoInput}
              onChange={e => setVideoInput(e.target.value)}
              placeholder="https://www.youtube.com/embed/VIDEO_ID"
              className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-navy focus:outline-none focus:ring-2 focus:ring-brand/30"
              onKeyDown={e => e.key === "Enter" && addVideoBlock()}
              autoFocus
            />
            <button onClick={addVideoBlock} className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 font-semibold">Add</button>
            <button onClick={() => { setShowVideoInput(false); setVideoInput(""); }}
              className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
          </div>
        )}

        {saving && <span className="text-xs text-slate-400">Saving…</span>}
        {saved  && <span className="text-xs text-green-600">✓ Saved</span>}
      </div>
    </div>
  );
}
