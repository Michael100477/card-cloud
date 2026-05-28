"use client";

import { useState } from "react";

interface Sample {
  id: string;
  beforeThumb: string;
  afterThumb: string;
  category: string;
  description: string;
  sourcePath: string;
  createdAt: string;
}

interface ScanResult { found: number; imported: number; skipped: number; errors: string[] }

const CATEGORY_LABELS: Record<string, string> = {
  graded_psa: "PSA", graded_psa_back: "PSA (back)", graded_psa_closeup: "PSA (close-up)",
  graded_bgs: "BGS", graded_sgc: "SGC", graded_cgc: "CGC", graded_hga: "HGA",
  graded_other: "Other graders",
  raw_bare: "Raw — bare card", raw_toploader: "Raw — toploader",
  raw_toploader_sleeve: "Raw — toploader + sleeve", raw_onetouch: "Raw — one-touch",
  raw_sleeve_only: "Raw — sleeve only", raw_unsorted: "Raw — unsorted",
  rejects: "Rejects",
};

/** Extract face and card name from "category/face/card_name" */
function parsePath(sourcePath: string): { face: string; cardName: string } {
  const parts = sourcePath.split("/");
  const face     = parts[1] ?? "";
  const cardName = parts[2] ?? parts[1] ?? "";
  return { face, cardName };
}

interface ParsedDescription {
  fields:    { key: string; value: string }[];
  diagnosis: { accepted: boolean; reason: string } | null;
}

/** Parse description.txt into structured fields + diagnosis line */
function parseDescription(desc: string): ParsedDescription {
  if (!desc) return { fields: [], diagnosis: null };

  const fields:    { key: string; value: string }[] = [];
  let   diagnosis: ParsedDescription["diagnosis"]    = null;

  for (const raw of desc.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("Accepted:")) {
      diagnosis = { accepted: true,  reason: line.slice("Accepted:".length).trim() };
    } else if (line.startsWith("Rejected:")) {
      diagnosis = { accepted: false, reason: line.slice("Rejected:".length).trim() };
    } else {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      fields.push({ key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() });
    }
  }

  return { fields, diagnosis };
}

export function PhotoTrainingClient({ initialSamples }: { initialSamples: Sample[] }) {
  const [samples,   setSamples]   = useState<Sample[]>(initialSamples);
  const [scanning,  setScanning]  = useState(false);
  const [scanResult,setScanResult]= useState<ScanResult | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [filter,    setFilter]    = useState<string>("all");

  async function scan() {
    setScanning(true);
    setScanResult(null);
    try {
      const r    = await fetch("/api/admin/photo-training/scan", { method: "POST" });
      const data = await r.json() as ScanResult;
      setScanResult(data);
      if (data.imported > 0) {
        const list = await fetch("/api/admin/photo-training?limit=100");
        const d    = await list.json() as { samples: Sample[] };
        setSamples(d.samples);
      }
    } catch (e) {
      setScanResult({ found: 0, imported: 0, skipped: 0, errors: [String(e)] });
    } finally {
      setScanning(false);
    }
  }

  async function deleteSample(id: string) {
    if (!confirm("Remove this training sample from the database? (Your files in C:\\cardtraining won't be deleted.)")) return;
    setDeleting(id);
    await fetch("/api/admin/photo-training", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setSamples(prev => prev.filter(s => s.id !== id));
    setDeleting(null);
  }

  const categories = [...new Set(samples.map(s => s.category))].sort();
  const filtered   = filter === "all" ? samples : samples.filter(s => s.category === filter);

  const gradedCount   = samples.filter(s => s.category.startsWith("graded")).length;
  const rawCount      = samples.filter(s => s.category.startsWith("raw")).length;
  const rejectCount   = samples.filter(s => s.category === "rejects").length;

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Photo Training Samples</h1>
        <p className="text-slate-400 text-sm max-w-2xl">
          Edit your card photos in any photo editor, save <code className="bg-slate-100 px-1 rounded text-xs">before.jpg</code> and <code className="bg-slate-100 px-1 rounded text-xs">after.jpg</code> into <code className="bg-slate-100 px-1 rounded text-xs">C:\cardtraining\[category]\[description]\</code>, then click <strong>Scan</strong>. Claude learns from the visual before→after transformation.
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-6">
        {[
          { label: "Total samples",  value: samples.length, color: "text-navy"       },
          { label: "Graded slabs",   value: gradedCount,    color: "text-brand"      },
          { label: "Raw cards",      value: rawCount,       color: "text-green-600"  },
          { label: "Rejects",        value: rejectCount,    color: "text-red-500"    },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 px-5 py-3 flex-1 text-center">
            <p className="text-slate-400 text-xs mb-0.5">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Scan section */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-8">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-navy font-semibold mb-1">Scan training folder</h2>
            <p className="text-slate-400 text-sm">
              Reads <code className="bg-slate-100 px-1 rounded text-xs">C:\cardtraining\[category]\[description]\</code> and imports any folder that has both a <code className="bg-slate-100 px-1 rounded text-xs">before.jpg</code> and an <code className="bg-slate-100 px-1 rounded text-xs">after.jpg</code>. Already-imported folders are skipped automatically.
            </p>

            {/* Expected folder structure reminder */}
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs text-slate-500 leading-relaxed">
              C:\cardtraining\<br />
              &nbsp;&nbsp;graded_bgs\<br />
              &nbsp;&nbsp;&nbsp;&nbsp;front\<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Bo Jackson 1987 170 Topps\<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;before.jpg<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;after.jpg<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;description.txt<br />
              &nbsp;&nbsp;&nbsp;&nbsp;back\<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Bo Jackson 1987 170 Topps\<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;before.jpg<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;after.jpg<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;description.txt<br />
              &nbsp;&nbsp;raw_bare\<br />
              &nbsp;&nbsp;&nbsp;&nbsp;back\<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Jose Canseco 1986 270 Donruss Rated Rookie\<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;before.jpg<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;after.jpg<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;description.txt<br />
              &nbsp;&nbsp;rejects\<br />
              &nbsp;&nbsp;&nbsp;&nbsp;front\<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Ken Griffey Jr 1989 41T Topps Traded\<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;before.jpg &nbsp;← no after.jpg needed<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;description.txt
            </div>
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 font-mono text-xs text-amber-700 leading-relaxed">
              <span className="font-bold">description.txt format:</span><br />
              Background type: dark table<br />
              Borders: Left 45px / Right 180px / Top 92px / Bottom 210px<br />
              Distance: Arm's length (34%)<br />
              Camera angle: Slight tilt (0.91 ratio)<br />
              Rotation: 4.5° clockwise<br />
              Lighting: Even<br />
              Orientation: Vertical<br />
              Position: Flat<br />
              Card size: Standard (2.5" × 3.5")<br />
              <br />
              Accepted: Can be cropped<br />
              <span className="opacity-60">— or one of —</span><br />
              Rejected: Multiple cards<br />
              Rejected: Card obscured<br />
              Rejected: Too far away<br />
              Rejected: Extreme angle<br />
              Rejected: Blurry<br />
              Rejected: Glare covering card<br />
              Rejected: Wrong subject<br />
              Rejected: Crop not needed
            </div>
          </div>

          <button onClick={scan} disabled={scanning}
            className="shrink-0 bg-brand text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2 text-sm transition-colors">
            {scanning
              ? <><SpinIcon className="w-4 h-4 animate-spin" /> Scanning…</>
              : <><ScanIcon className="w-4 h-4" /> Scan C:\cardtraining</>
            }
          </button>
        </div>

        {/* Scan result */}
        {scanResult && (
          <div className={`mt-4 rounded-xl p-4 text-sm ${scanResult.errors.length > 0 && scanResult.imported === 0 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
            <p className="font-semibold text-navy mb-1">
              Scan complete — {scanResult.found} pair{scanResult.found !== 1 ? "s" : ""} found
            </p>
            <div className="flex gap-6 text-slate-600">
              <span className="text-green-700 font-medium">✓ {scanResult.imported} imported</span>
              <span className="text-slate-500">↷ {scanResult.skipped} already existed</span>
              {scanResult.errors.length > 0 && <span className="text-red-600">✗ {scanResult.errors.length} errors</span>}
            </div>
            {scanResult.errors.length > 0 && (
              <ul className="mt-2 text-red-600 text-xs space-y-0.5">
                {scanResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Gallery */}
      {samples.length > 0 && (
        <div>
          {/* Filter tabs */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-navy font-bold text-lg">Training gallery ({samples.length})</h2>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              {["all", ...categories].map(cat => (
                <button key={cat} onClick={() => setFilter(cat)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filter === cat ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
                  {cat === "all" ? `All (${samples.length})` : `${CATEGORY_LABELS[cat] ?? cat} (${samples.filter(s => s.category === cat).length})`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {filtered.map(s => {
              const isRejectCat = s.category === "rejects";
              const { face, cardName } = parsePath(s.sourcePath);
              const { fields, diagnosis } = parseDescription(s.description);
              const isReject = isRejectCat || (diagnosis && !diagnosis.accepted);
              return (
                <div key={s.id} className={`group bg-white rounded-2xl border overflow-hidden ${isReject ? "border-red-100" : "border-slate-100"}`}>

                  {/* Header row */}
                  <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap ${isReject ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"}`}>
                    <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                      {/* Category badge */}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${isReject ? "bg-red-100 text-red-700" : "bg-brand/10 text-brand"}`}>
                        {CATEGORY_LABELS[s.category] ?? s.category}
                      </span>
                      {/* Face badge */}
                      {face && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${face === "back" ? "bg-slate-200 text-slate-600" : "bg-blue-100 text-blue-700"}`}>
                          {face}
                        </span>
                      )}
                      {/* Card name */}
                      <span className="text-navy text-sm font-semibold">{cardName}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Diagnosis badge */}
                      {diagnosis && (
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                          diagnosis.accepted
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {diagnosis.accepted ? `✓ ${diagnosis.reason}` : `✗ ${diagnosis.reason}`}
                        </span>
                      )}
                      <button onClick={() => deleteSample(s.id)} disabled={deleting === s.id}
                        className="text-slate-300 hover:text-red-500 text-xs transition-colors disabled:opacity-50">
                        {deleting === s.id ? "…" : "Remove"}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-0">
                    {/* Before / After images */}
                    <div className={`grid gap-0 flex-1 ${isReject ? "" : "grid-cols-2"}`}>
                      <div className="p-3 border-r border-slate-100">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Before</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.beforeThumb} alt="before" className="w-full rounded-lg object-contain max-h-44 bg-slate-50" />
                      </div>
                      {!isReject && (
                        <div className="p-3">
                          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">After ✓</p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.afterThumb} alt="after" className="w-full rounded-lg object-contain max-h-44 bg-slate-50" />
                        </div>
                      )}
                    </div>

                    {/* Descriptor properties panel */}
                    {fields.length > 0 && (
                      <div className="w-52 shrink-0 border-l border-slate-100 p-3 bg-slate-50/50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Photo properties</p>
                        <dl className="flex flex-col gap-2">
                          {fields.map(f => (
                            <div key={f.key}>
                              <dt className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide leading-none">{f.key}</dt>
                              <dd className="text-xs text-navy font-medium mt-0.5 leading-snug">{f.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {samples.length === 0 && !scanning && (
        <div className="bg-amber/5 border border-amber/20 rounded-2xl p-8 text-center">
          <p className="text-navy font-semibold mb-2">No training samples yet</p>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Create <code className="bg-slate-100 px-1 rounded text-xs">before.jpg</code> + <code className="bg-slate-100 px-1 rounded text-xs">after.jpg</code> pairs in your photo editor, save them into the folder structure above, then click <strong>Scan C:\cardtraining</strong>.
          </p>
        </div>
      )}
    </div>
  );
}

function ScanIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>;
}
function SpinIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
}
