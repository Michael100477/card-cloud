"use client";

import { useCallback, useState } from "react";

interface PhotoResult { name: string; ok: boolean; original?: string; result?: string; info?: string; error?: string; rejected?: boolean; reason?: string; guidance?: string }

export function PhotoFixClient() {
  const [files,      setFiles]      = useState<File[]>([]);
  const [previews,   setPreviews]   = useState<string[]>([]);
  const [results,    setResults]    = useState<PhotoResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [drag,       setDrag]       = useState(false);

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const valid = Array.from(incoming).filter(f => f.type.startsWith("image/")).slice(0, 10);
    if (!valid.length) return;
    setFiles(prev => [...prev, ...valid].slice(0, 10));
    valid.forEach(f => {
      const reader = new FileReader();
      reader.onload = e => setPreviews(prev => [...prev, e.target?.result as string].slice(0, 10));
      reader.readAsDataURL(f);
    });
    setResults([]);
  }, []);

  function removeFile(i: number) {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
    setResults([]);
  }

  function clearAll() { setFiles([]); setPreviews([]); setResults([]); }

  async function process() {
    if (!files.length) return;
    setProcessing(true);
    setResults([]);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append("files", f));
      const r = await fetch("/api/admin/photo-fix", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Processing failed");
      setResults(data.results);
    } catch (e) {
      alert(`Error: ${e}`);
    } finally {
      setProcessing(false);
    }
  }

  function downloadOne(dataUrl: string, name: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `fixed_${name.replace(/\.[^.]+$/, ".jpg")}`;
    a.click();
  }

  const successCount  = results.filter(r => r.ok && r.result && !r.rejected).length;
  const rejectCount   = results.filter(r => r.rejected).length;

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Card Photo Straightener</h1>
        <p className="text-slate-400 text-sm max-w-2xl">
          Upload card photos. The AI generates an edge map of each image to locate the card's exact boundary, then straightens and crops with a clean uniform border — no manual selection needed.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        className={`relative border-2 border-dashed rounded-2xl transition-colors mb-6 ${drag ? "border-brand bg-brand/5" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"}`}
      >
        <input type="file" multiple accept="image/*" onChange={e => addFiles(e.target.files)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        <div className="px-8 py-10 text-center pointer-events-none">
          <div className="w-14 h-14 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CameraIcon className="w-7 h-7 text-slate-500" />
          </div>
          <p className="text-navy font-semibold mb-1">Drop photos here or click to browse</p>
          <p className="text-slate-400 text-sm">JPEG, PNG, HEIC · Up to 10 images at once</p>
        </div>
      </div>

      {/* Staged files */}
      {files.length > 0 && results.length === 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-navy font-semibold text-sm">{files.length} photo{files.length !== 1 ? "s" : ""} queued</p>
            <button onClick={clearAll} className="text-slate-400 hover:text-red-500 text-xs transition-colors">Clear all</button>
          </div>
          <div className="flex flex-wrap gap-3">
            {previews.map((src, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={files[i]?.name} className="w-20 h-28 object-cover rounded-xl border border-slate-200" />
                <button onClick={() => removeFile(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                <p className="text-[9px] text-slate-400 text-center mt-1 max-w-[80px] truncate">{files[i]?.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Process button */}
      {files.length > 0 && !processing && results.length === 0 && (
        <button onClick={process}
          className="mb-8 bg-brand text-white font-bold px-8 py-3.5 rounded-xl text-sm hover:bg-blue-600 transition-colors flex items-center gap-2">
          <MagicIcon className="w-4 h-4" />
          Straighten {files.length} photo{files.length !== 1 ? "s" : ""} with AI
        </button>
      )}

      {/* Processing */}
      {processing && (
        <div className="flex items-center gap-3 mb-8 bg-brand/5 border border-brand/20 rounded-xl px-5 py-4">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-navy font-semibold text-sm">Processing {files.length} photo{files.length !== 1 ? "s" : ""}…</p>
            <p className="text-slate-400 text-xs mt-0.5">Generating edge maps and locating cards. ~10–25 seconds per photo.</p>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-navy font-bold text-lg">Results</h2>
              <p className="text-slate-400 text-sm">
                {successCount} of {results.length} processed
                {rejectCount > 0 && <span className="ml-2 text-red-500 font-medium">· {rejectCount} rejected</span>}
              </p>
            </div>
            <div className="flex gap-2">
              {successCount > 0 && (
                <button onClick={() => results.filter(r => r.ok && r.result).forEach(r => downloadOne(r.result!, r.name))}
                  className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-600 flex items-center gap-1.5">
                  <DownloadIcon className="w-4 h-4" /> Download all
                </button>
              )}
              <button onClick={clearAll} className="border border-slate-200 text-slate-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-50">
                Start over
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {results.map((result, i) => {
              const isRejected = result.ok && result.rejected;
              const isSuccess  = result.ok && !!result.result;
              const borderCls  = isRejected ? "border-red-100" : isSuccess ? "border-slate-100" : "border-amber-100";
              const headerCls  = isRejected ? "bg-red-50 border-b border-red-100" : isSuccess ? "bg-slate-50 border-b border-slate-100" : "bg-amber-50 border-b border-amber-100";
              return (
                <div key={i} className={`bg-white rounded-2xl border overflow-hidden ${borderCls}`}>
                  <div className={`px-5 py-3 flex items-center justify-between ${headerCls}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {isSuccess  && <CheckIcon className="w-4 h-4 text-green-500 shrink-0" />}
                      {isRejected && <BlockIcon className="w-4 h-4 text-red-500 shrink-0" />}
                      {!isSuccess && !isRejected && <WarnIcon className="w-4 h-4 text-amber-500 shrink-0" />}
                      <span className="text-navy font-semibold text-sm truncate">{result.name}</span>
                      {isRejected && result.reason && (
                        <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full shrink-0">{result.reason}</span>
                      )}
                    </div>
                    {isSuccess && (
                      <button onClick={() => downloadOne(result.result!, result.name)}
                        className="text-brand text-xs font-semibold hover:underline shrink-0 flex items-center gap-1">
                        <DownloadIcon className="w-3.5 h-3.5" /> Download
                      </button>
                    )}
                  </div>
                  <div className="p-4">
                    {/* Rejected photo */}
                    {isRejected && (
                      <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex gap-3 items-start">
                        <BlockIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-red-700 font-semibold text-sm">Photo cannot be processed</p>
                          {result.guidance && <p className="text-red-600 text-xs mt-1 leading-relaxed">{result.guidance}</p>}
                        </div>
                      </div>
                    )}
                    {!isRejected && <p className="text-slate-500 text-xs mb-4 italic">{result.info ?? result.error}</p>}
                    {/* Success: before/after grid */}
                    {isSuccess && result.original && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Original</p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={result.original} alt="original" className="w-full rounded-xl border border-slate-100 object-contain max-h-72" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">Straightened ✓</p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={result.result} alt="result" className="w-full rounded-xl border border-green-100 object-contain max-h-72" />
                        </div>
                      </div>
                    )}
                    {/* Rejected: show original so they can see what was wrong */}
                    {isRejected && result.original && (
                      <div className="max-w-xs">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Your photo</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={result.original} alt="original" className="w-full rounded-xl border border-red-100 object-contain max-h-48" />
                      </div>
                    )}
                    {/* No card detected / other error: show original */}
                    {result.ok && result.original && !result.result && !isRejected && (
                      <div className="max-w-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={result.original} alt="original" className="w-full rounded-xl border border-slate-100 object-contain max-h-48" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tips */}
      {files.length === 0 && results.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mt-2">
          <p className="text-navy font-semibold text-sm mb-2">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {[
              { step: "1", title: "Edge map", body: "Sharp generates a version where solid backgrounds go dark and card boundaries appear bright — regardless of background colour." },
              { step: "2", title: "AI locates card", body: "Claude sees both the original and edge map together. The edge map makes the card's rectangle visually obvious even on orange or patterned backgrounds." },
              { step: "3", title: "Crop + straighten", body: "Corners are used to correct rotation precisely. A 7% uniform border is added so buyers can see card edges and corners." },
            ].map(s => (
              <div key={s.step} className="flex gap-3">
                <div className="w-6 h-6 bg-brand text-white text-xs font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">{s.step}</div>
                <div>
                  <p className="text-navy text-sm font-semibold">{s.title}</p>
                  <p className="text-slate-500 text-xs leading-relaxed mt-0.5">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-slate-400 text-xs border-t border-slate-200 pt-3 mt-1">
            <strong className="text-slate-500">Best results:</strong> Shoot the <strong className="text-slate-500">front</strong> of the card with the label at the <strong className="text-slate-500">top</strong> · Let the slab fill <strong className="text-slate-500">35–50%</strong> of the frame (move closer) · Shoot <strong className="text-slate-500">straight overhead</strong> · Any background colour works
          </p>
        </div>
      )}
    </div>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>;
}
function MagicIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 9-9" /><path d="M12.5 6.5 16 10l-7 7-3.5-3.5 7-7Z" /><path d="M15 4V2m0 14v-2M8 9H2m14 0h-2" /></svg>;
}
function DownloadIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
}
function CheckIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}
function WarnIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}
function BlockIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>;
}
