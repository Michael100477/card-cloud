"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  variant?: "primary" | "ghost";
}

export function NewPostButton({ variant = "primary" }: Props) {
  const [open,       setOpen]       = useState(false);
  const [caption,    setCaption]    = useState("");
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [previews,   setPreviews]   = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router  = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    setLocalFiles(prev => {
      const combined = [...prev, ...incoming].slice(0, 4);
      setPreviews(combined.map(f => URL.createObjectURL(f)));
      return combined;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(idx: number) {
    setLocalFiles(prev => {
      const next = prev.filter((_, i) => i !== idx);
      setPreviews(next.map(f => URL.createObjectURL(f)));
      return next;
    });
  }

  function close() {
    setOpen(false);
    setCaption("");
    setLocalFiles([]);
    setPreviews([]);
    setError("");
  }

  async function submit() {
    if (!caption.trim() && localFiles.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const photos: string[] = [];
      for (const file of localFiles) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        if (!r.ok) throw new Error("Image upload failed");
        const { url } = await r.json();
        photos.push(url);
      }

      const r = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: caption.trim() || null, photos }),
      });
      if (!r.ok) throw new Error("Failed to post");

      close();
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = (caption.trim().length > 0 || localFiles.length > 0) && !submitting;

  const triggerCls = variant === "ghost"
    ? "flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
    : "flex items-center gap-2 bg-brand text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-600 transition-colors";

  return (
    <>
      <button onClick={() => setOpen(true)} className={triggerCls}>
        <PlusIcon className="w-4 h-4" />
        New Post
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-navy font-bold text-base">New Post</h2>
              <button onClick={close} className="text-slate-400 hover:text-navy transition-colors p-1">
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">

              {/* Photo area */}
              {previews.length > 0 ? (
                <div>
                  <div className={`grid gap-1 ${previews.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {previews.map((src, i) => (
                      <div
                        key={i}
                        className={`relative overflow-hidden rounded-xl bg-slate-100 ${
                          previews.length === 1 ? "aspect-[4/3]" : "aspect-square"
                        } ${previews.length === 3 && i === 2 ? "col-span-2 aspect-video" : ""}`}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeFile(i)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                        >
                          <CloseIcon className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {localFiles.length < 4 && (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="mt-2 text-brand text-sm font-medium hover:underline"
                    >
                      + Add photo ({localFiles.length}/4)
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-200 rounded-xl py-8 flex flex-col items-center gap-2 text-slate-400 hover:border-brand hover:text-brand transition-colors"
                >
                  <PhotoIcon className="w-8 h-8" />
                  <span className="text-sm font-medium">Add photos (optional, up to 4)</span>
                </button>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Caption */}
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="What's on your mind?"
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 placeholder-slate-300"
              />

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex gap-3 justify-end">
                <button onClick={close} className="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={!canSubmit}
                  className="px-5 py-2 text-sm font-semibold bg-brand text-white rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-colors"
                >
                  {submitting ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
}
function CloseIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>;
}
function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
