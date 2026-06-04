"use client";

import { useState } from "react";
import Link from "next/link";

interface Article {
  id: string; title: string; slug: string; excerpt: string | null;
  category: string | null; status: string; source: string;
  publishedAt: string | null; createdAt: string; coverImage: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  draft:     "bg-slate-100 text-slate-500",
};
const SOURCE_STYLE: Record<string, string> = {
  api:    "bg-brand/10 text-brand",
  manual: "bg-purple-100 text-purple-700",
};

export function ArticlesClient({ initialArticles }: { initialArticles: Article[] }) {
  const [articles, setArticles] = useState(initialArticles);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [toggling,  setToggling]  = useState<string | null>(null);
  const [error,     setError]     = useState("");

  // New article form
  const [title,    setTitle]    = useState("");
  const [category, setCategory] = useState("");
  const [excerpt,  setExcerpt]  = useState("");
  const [content,  setContent]  = useState("");
  const [cover,    setCover]    = useState("");
  const [status,   setStatus]   = useState("published");

  const published = articles.filter(a => a.status === "published").length;
  const drafts    = articles.filter(a => a.status === "draft").length;
  const apiCount  = articles.filter(a => a.source === "api").length;

  async function createArticle(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setError("Title and content are required."); return; }
    setSaving(true); setError("");
    const r = await fetch("/api/admin/articles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category: category || null, excerpt: excerpt || null, content, coverImage: cover || null, status }),
    });
    const data = await r.json();
    if (!r.ok) { setError(data.error ?? "Failed"); setSaving(false); return; }
    setArticles(prev => [data, ...prev]);
    setTitle(""); setCategory(""); setExcerpt(""); setContent(""); setCover(""); setStatus("published");
    setShowForm(false); setSaving(false);
  }

  async function toggleStatus(article: Article) {
    const next = article.status === "published" ? "draft" : "published";
    setToggling(article.id);
    const r = await fetch(`/api/admin/articles/${article.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (r.ok) {
      const updated = await r.json();
      setArticles(prev => prev.map(a => a.id === article.id
        ? { ...a, status: updated.status, publishedAt: updated.publishedAt ?? null }
        : a));
    }
    setToggling(null);
  }

  async function deleteArticle(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    setDeleting(id);
    await fetch(`/api/admin/articles/${id}`, { method: "DELETE" });
    setArticles(prev => prev.filter(a => a.id !== id));
    setDeleting(null);
  }

  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30";

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">Articles</h1>
          <p className="text-slate-400 text-sm">
            {articles.length} total · {published} published · {drafts} drafts · {apiCount} via API
          </p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setError(""); }}
          className="bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-600 transition-colors shrink-0">
          {showForm ? "Cancel" : "+ New article"}
        </button>
      </div>

      {/* API info strip */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 px-5 py-4 mb-6 text-sm text-slate-600 flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">🤖</span>
        <div>
          <p className="font-medium text-navy">AI Agent API</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Post articles programmatically: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">POST /api/articles</code> with{" "}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">Authorization: Bearer &lt;article_api_key&gt;</code>.
            Set the key in Admin → API Keys.
          </p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={createArticle}
          className="bg-white rounded-2xl border border-brand/30 p-6 mb-6 flex flex-col gap-4">
          <p className="text-navy font-semibold">New article</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Article title" className={inp} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Category</label>
              <input value={category} onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Market News, How To, Community" className={inp} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={inp + " bg-white"}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Excerpt <span className="text-slate-300">(short summary shown in strips)</span></label>
              <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} rows={2}
                placeholder="One or two sentences summarising the article." className={inp + " resize-none"} />
            </div>
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Content</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={8}
                placeholder="Full article body…" className={inp + " resize-y font-mono text-xs"} />
            </div>
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Cover image URL <span className="text-slate-300">(optional)</span></label>
              <input value={cover} onChange={e => setCover(e.target.value)}
                placeholder="https://example.com/image.jpg" className={inp} />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !title || !content}
              className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-600 disabled:opacity-50">
              {saving ? "Saving…" : "Save article"}
            </button>
          </div>
        </form>
      )}

      {/* Articles list */}
      {articles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-slate-400 text-sm">No articles yet. Create one above or post via the API.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3">Article</th>
                <th className="text-left px-5 py-3">Category</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Source</th>
                <th className="text-left px-5 py-3">Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {articles.map((a, i) => (
                <tr key={a.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  <td className="px-5 py-3">
                    <p className="text-navy font-medium">{a.title}</p>
                    {a.excerpt && <p className="text-slate-400 text-xs truncate max-w-xs mt-0.5">{a.excerpt}</p>}
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{a.category ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[a.status] ?? "bg-slate-100 text-slate-500"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SOURCE_STYLE[a.source] ?? "bg-slate-100 text-slate-500"}`}>
                      {a.source}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : new Date(a.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-3">
                      <Link href={`/admin/articles/${a.id}`} className="text-brand text-xs hover:underline">Edit</Link>
                      <button onClick={() => toggleStatus(a)} disabled={toggling === a.id}
                        className="text-slate-400 hover:text-navy text-xs transition-colors disabled:opacity-50">
                        {toggling === a.id ? "…" : a.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <button onClick={() => deleteArticle(a.id, a.title)} disabled={deleting === a.id}
                        className="text-slate-400 hover:text-red-500 text-xs transition-colors disabled:opacity-50">
                        {deleting === a.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


