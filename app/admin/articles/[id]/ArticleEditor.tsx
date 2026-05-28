"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Article {
  id: string; title: string; slug: string; excerpt: string | null;
  content: string; coverImage: string | null; category: string | null;
  status: string; source: string; publishedAt: string | null;
  createdAt: string; updatedAt: string;
}

export function ArticleEditor({ article: initial }: { article: Article }) {
  const router = useRouter();
  const [title,    setTitle]    = useState(initial.title);
  const [category, setCategory] = useState(initial.category ?? "");
  const [excerpt,  setExcerpt]  = useState(initial.excerpt ?? "");
  const [content,  setContent]  = useState(initial.content);
  const [cover,    setCover]    = useState(initial.coverImage ?? "");
  const [status,   setStatus]   = useState(initial.status);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");

  async function save() {
    if (!title.trim() || !content.trim()) { setError("Title and content are required."); return; }
    setSaving(true); setError("");
    const r = await fetch(`/api/admin/articles/${initial.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category: category || null, excerpt: excerpt || null, content, coverImage: cover || null, status }),
    });
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else { const d = await r.json(); setError(d.error ?? "Failed"); }
    setSaving(false);
  }

  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30";

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/admin/articles")}
          className="text-slate-400 hover:text-navy text-sm transition-colors">← Articles</button>
        <span className="text-slate-200">/</span>
        <p className="text-navy text-sm font-medium truncate">{initial.title}</p>
        <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${initial.source === "api" ? "bg-brand/10 text-brand" : "bg-purple-100 text-purple-700"}`}>
          {initial.source}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-slate-400 text-xs mb-1 block">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Category</label>
            <input value={category} onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Market News" className={inp} />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className={inp + " bg-white"}>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs mb-1 block">Excerpt</label>
            <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} rows={2}
              placeholder="Short summary…" className={inp + " resize-none"} />
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs mb-1 block">Content</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={16}
              className={inp + " resize-y font-mono text-xs"} />
          </div>
          <div className="col-span-2">
            <label className="text-slate-400 text-xs mb-1 block">Cover image URL</label>
            <input value={cover} onChange={e => setCover(e.target.value)}
              placeholder="https://example.com/image.jpg" className={inp} />
            {cover && <img src={cover} alt="" className="mt-2 h-32 rounded-xl object-cover" />}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving}
            className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-600 disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="text-green-600 text-sm">✓ Saved</span>}
          <p className="text-slate-400 text-xs ml-auto">
            Slug: <span className="font-mono">{initial.slug}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
