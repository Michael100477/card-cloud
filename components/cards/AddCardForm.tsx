"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createCardAction } from "@/lib/actions/cards";
import { cn } from "@/lib/utils";
import type { GraderCardData } from "@/lib/graders";

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORTS = ["Baseball","Football","Basketball","Hockey","Soccer","Golf","Tennis","Boxing","MMA","NASCAR","Pokémon","Magic: The Gathering","Yu-Gi-Oh!","Other"];
const MANUFACTURERS = ["Topps","Panini","Upper Deck","Bowman","Fleer","Donruss","Score","Leaf","Pacific","O-Pee-Chee","Stadium Club","Select","Prizm","Chrome","Finest","SPx"];
const GRADE_COMPANIES = ["PSA","BGS","SGC","CGC","HGA","Other"];
const GRADE_OPTIONS: Record<string, string[]> = {
  PSA: ["10","9.5","9","8.5","8","7.5","7","6","5","4","3","2","1.5","1"],
  BGS: ["10 (Black Label)","10 (Pristine)","9.5","9","8.5","8","7.5","7","6.5","6"],
  SGC: ["10","9.5","9","8.5","8","7.5","7","6","5","4","3","2","1"],
  CGC: ["10","9.5","9","8.5","8","7.5","7","6","5"],
  HGA: ["10","9.5","9","8.5","8","7.5","7"],
};
const PRESET_TAGS = ["Rookie","Auto","Jersey","Numbered","1/1","Refractor","Parallel","Short Print","Vintage","Base","Holo","Prizm"];
const ACQ_SOURCES = ["Purchased","Traded","Gift","Pack pull","Auction","Other"];

// ─── Types ────────────────────────────────────────────────────────────────────

const BLANK = {
  player:"", year: String(new Date().getFullYear()),
  manufacturer:"", set:"", subset:"", cardNumber:"", serialNumber:"",
  sport:"", team:"", gradeCompany:"", grade:"", certNumber:"",
  notes:"", conditionNotes:"", acquiredDate:"", acquiredPrice:"", acquiredSource:"",
};

type Tab = "manual" | "scan" | "import";
interface PhotoPreview { file: File; preview: string; }
interface Props { collection: { id: string; name: string } | null; }

// ─── Component ────────────────────────────────────────────────────────────────

export function AddCardForm({ collection }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form fields
  const [tab, setTab]   = useState<Tab>("manual");
  const [form, setForm] = useState({ ...BLANK });

  // Tags — preset toggles + free-text custom tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTags,   setCustomTags]   = useState<string[]>([]);
  const [tagInput,     setTagInput]     = useState("");

  // Photos — separate slots for front, back, and additional
  const [frontPhoto,       setFrontPhoto]       = useState<PhotoPreview | null>(null);
  const [backPhoto,        setBackPhoto]        = useState<PhotoPreview | null>(null);
  const [additionalPhotos, setAdditionalPhotos] = useState<PhotoPreview[]>([]);
  const [additionalOpen,   setAdditionalOpen]   = useState(false);

  // Misc
  const [acqOpen,    setAcqOpen]    = useState(false);
  const [error,      setError]      = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // File input refs — one per slot
  const frontInputRef      = useRef<HTMLInputElement>(null);
  const backInputRef       = useRef<HTMLInputElement>(null);
  const addlInputRef       = useRef<HTMLInputElement>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const setField = (f: keyof typeof BLANK, v: string) => setForm(p => ({ ...p, [f]: v }));

  function togglePreset(tag: string) {
    setSelectedTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag]);
  }

  function addCustomTag() {
    const val = tagInput.trim();
    if (!val || val.length > 40) return;
    const allTags = [...selectedTags, ...customTags];
    if (allTags.map(t => t.toLowerCase()).includes(val.toLowerCase())) {
      setTagInput(""); return;
    }
    setCustomTags(p => [...p, val]);
    setTagInput("");
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); addCustomTag(); }
  }

  function setSlotPhoto(slot: "front" | "back", file: File | null) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    const entry   = { file, preview };
    if (slot === "front") {
      if (frontPhoto) URL.revokeObjectURL(frontPhoto.preview);
      setFrontPhoto(entry);
    } else {
      if (backPhoto) URL.revokeObjectURL(backPhoto.preview);
      setBackPhoto(entry);
    }
  }

  function clearSlotPhoto(slot: "front" | "back") {
    if (slot === "front" && frontPhoto) { URL.revokeObjectURL(frontPhoto.preview); setFrontPhoto(null); }
    if (slot === "back"  && backPhoto)  { URL.revokeObjectURL(backPhoto.preview);  setBackPhoto(null);  }
  }

  function addAdditional(files: FileList | null) {
    if (!files) return;
    const remaining = 10 - additionalPhotos.length;
    const added = Array.from(files).slice(0, remaining).map(file => ({
      file, preview: URL.createObjectURL(file),
    }));
    setAdditionalPhotos(p => [...p, ...added]);
  }

  function removeAdditional(i: number) {
    setAdditionalPhotos(p => {
      URL.revokeObjectURL(p[i].preview);
      return p.filter((_, idx) => idx !== i);
    });
  }

  function resetForm() {
    setForm({ ...BLANK });
    setSelectedTags([]); setCustomTags([]); setTagInput("");
    if (frontPhoto) URL.revokeObjectURL(frontPhoto.preview);
    if (backPhoto)  URL.revokeObjectURL(backPhoto.preview);
    additionalPhotos.forEach(p => URL.revokeObjectURL(p.preview));
    setFrontPhoto(null); setBackPhoto(null); setAdditionalPhotos([]);
    setAcqOpen(false); setAdditionalOpen(false);
  }

  function validate() {
    if (!form.player.trim())       return "Player / card name is required.";
    if (!form.year || isNaN(Number(form.year))) return "A valid year is required.";
    if (!form.manufacturer.trim()) return "Manufacturer is required.";
    if (!form.set.trim())          return "Set is required.";
    return null;
  }

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Upload failed");
    }
    return (await res.json()).url as string;
  }

  function doSave(addAnother: boolean) {
    const err = validate();
    if (err) { setError(err); return; }
    setError(""); setSuccessMsg("");

    startTransition(async () => {
      // Upload all photos first, collect URLs
      const photoUrls: string[] = [];
      try {
        if (frontPhoto)      photoUrls.push(await uploadFile(frontPhoto.file));
        if (backPhoto)       photoUrls.push(await uploadFile(backPhoto.file));
        for (const p of additionalPhotos) photoUrls.push(await uploadFile(p.file));
      } catch (uploadErr) {
        setError(uploadErr instanceof Error ? uploadErr.message : "Photo upload failed.");
        return;
      }

      const result = await createCardAction({
        player:       form.player,
        year:         Number(form.year),
        manufacturer: form.manufacturer,
        set:          form.set,
        subset:       form.subset       || undefined,
        cardNumber:   form.cardNumber   || undefined,
        sport:        form.sport        || undefined,
        team:         form.team         || undefined,
        gradeCompany: form.gradeCompany || undefined,
        grade:        form.grade        || undefined,
        certNumber:   form.certNumber   || undefined,
        serialNumber: form.serialNumber || undefined,
        tags: [...selectedTags, ...customTags],
        conditionNotes: form.conditionNotes || undefined,
        notes:        form.notes         || undefined,
        photos:       photoUrls,
        acquiredDate:   form.acquiredDate  || undefined,
        acquiredPrice:  form.acquiredPrice ? Number(form.acquiredPrice) : undefined,
        acquiredSource: form.acquiredSource || undefined,
        collectionId:   collection?.id,
      });

      if (result?.error) { setError(result.error); return; }

      if (addAnother) {
        const saved = form.player;
        resetForm();
        setSuccessMsg(`${saved} saved! Add another card.`);
        router.refresh();
      } else {
        router.push(`/dashboard/cards/${result.cardId}`);
      }
    });
  }

  const gradeOptions = form.gradeCompany ? GRADE_OPTIONS[form.gradeCompany] : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href={collection ? `/dashboard/collections/${collection.id}` : "/dashboard"}
          className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 text-sm mb-3 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {collection ? collection.name : "My Collections"}
        </Link>
        <h1 className="text-navy text-2xl font-bold">Add a card</h1>
        {collection && (
          <p className="text-slate-500 text-sm mt-0.5">
            Adding to <span className="font-medium text-navy">{collection.name}</span>
          </p>
        )}
      </div>

      {/* Method tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6">
        {(["manual","scan","import"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors",
              tab === t ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"
            )}
          >
            {t === "scan" ? "Scan slab" : t === "import" ? "Bulk import" : "Manual"}
          </button>
        ))}
      </div>

      {/* Bulk import — coming soon */}
      {tab === "import" && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <p className="text-3xl mb-3">📤</p>
          <p className="text-navy font-semibold">Bulk CSV import coming soon</p>
          <p className="text-slate-400 text-sm mt-1">This feature is in the next phase of development.</p>
          <button onClick={() => setTab("manual")} className="mt-4 text-brand text-sm font-medium hover:underline">
            Use manual entry instead
          </button>
        </div>
      )}

      {/* Scan slab */}
      {tab === "scan" && (
        <SlabScanner
          onDetected={(data) => {
            // Pre-fill form fields with whatever the grader API returned
            if (data.player)       setField("player",       data.player);
            if (data.year)         setField("year",         String(data.year));
            if (data.manufacturer) setField("manufacturer", data.manufacturer);
            if (data.set)          setField("set",          data.set);
            if (data.cardNumber)   setField("cardNumber",   data.cardNumber);
            if (data.grade)        setField("grade",        data.grade);
            if (data.sport)        setField("sport",        data.sport);
            if (data.grader && data.grader !== "Unknown") {
              setField("gradeCompany", data.grader);
            }
            setField("certNumber", data.certNumber);
            setTab("manual"); // Switch to manual so user can review + save
          }}
        />
      )}

      {/* Manual form */}
      {tab === "manual" && (
        <div className="flex flex-col gap-5">

          {error      && <div className="bg-red-50 border border-red-100 text-alert text-sm rounded-xl px-4 py-3">{error}</div>}
          {successMsg && <div className="bg-green-50 border border-green-100 text-success text-sm rounded-xl px-4 py-3 font-medium">{successMsg}</div>}

          {/* ── Card Identity ──────────────────────────────────────────── */}
          <Section title="Card identity">
            <Field label="Player / Card name" required>
              <input value={form.player} onChange={e => setField("player", e.target.value)}
                className={input} placeholder="e.g. Mike Trout, Charizard, Black Lotus" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Year" required>
                <input value={form.year} onChange={e => setField("year", e.target.value)}
                  type="number" min={1800} max={2099} className={input} placeholder="e.g. 2011" />
              </Field>
              <Field label="Manufacturer" required>
                <input value={form.manufacturer} onChange={e => setField("manufacturer", e.target.value)}
                  list="mfr-list" className={input} placeholder="e.g. Topps" />
                <datalist id="mfr-list">{MANUFACTURERS.map(m => <option key={m} value={m} />)}</datalist>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Set" required>
                <input value={form.set} onChange={e => setField("set", e.target.value)}
                  className={input} placeholder="e.g. Topps Chrome" />
              </Field>
              <Field label="Subset">
                <input value={form.subset} onChange={e => setField("subset", e.target.value)}
                  className={input} placeholder="e.g. Refractor, RC" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Card number">
                <input value={form.cardNumber} onChange={e => setField("cardNumber", e.target.value)}
                  className={input} placeholder="e.g. #179" />
              </Field>
              <Field label="Serial number">
                <input
                  value={form.serialNumber}
                  onChange={e => {
                    setField("serialNumber", e.target.value);
                    // Auto-select "Numbered" tag when a serial is entered
                    if (e.target.value.trim() && !selectedTags.includes("Numbered")) {
                      setSelectedTags(p => [...p, "Numbered"]);
                    }
                  }}
                  className={input}
                  placeholder="e.g. 5/10, 23/49, /25, 1/1"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sport / Type">
                <select value={form.sport} onChange={e => setField("sport", e.target.value)} className={input}>
                  <option value="">Select sport</option>
                  {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Team">
                <input value={form.team} onChange={e => setField("team", e.target.value)}
                  className={input} placeholder="e.g. Los Angeles Angels" />
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={e => setField("notes", e.target.value)}
                rows={2} className={cn(input, "resize-none")}
                placeholder="e.g. Pulled from a retail box, signed at a show, bought from a collector friend…"
              />
            </Field>
            <Field label="Condition notes">
              <textarea
                value={form.conditionNotes}
                onChange={e => setField("conditionNotes", e.target.value)}
                rows={2} className={cn(input, "resize-none")}
                placeholder="Any notable scratches, creases, or observations…"
              />
            </Field>
          </Section>

          {/* ── Grading ────────────────────────────────────────────────── */}
          <Section title="Grading">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Grade company">
                <select value={form.gradeCompany}
                  onChange={e => { setField("gradeCompany", e.target.value); setField("grade", ""); }}
                  className={input}
                >
                  <option value="">None / Raw</option>
                  {GRADE_COMPANIES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Grade">
                {gradeOptions ? (
                  <select value={form.grade} onChange={e => setField("grade", e.target.value)} className={input}>
                    <option value="">Select grade</option>
                    {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    <option value="Other">Other</option>
                  </select>
                ) : (
                  <input value={form.grade} onChange={e => setField("grade", e.target.value)}
                    className={input} placeholder="e.g. 9.5" disabled={!form.gradeCompany} />
                )}
              </Field>
              <Field label="Cert number">
                <input value={form.certNumber} onChange={e => setField("certNumber", e.target.value)}
                  className={input} placeholder="e.g. 12345678" />
              </Field>
            </div>
          </Section>

          {/* ── Tags ───────────────────────────────────────────────────── */}
          <Section title="Tags">
            {/* Preset tag pills */}
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.map(tag => (
                <button key={tag} type="button" onClick={() => togglePreset(tag)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    selectedTags.includes(tag)
                      ? "bg-brand text-white border-brand"
                      : "bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Custom tag input */}
            <div>
              <p className="text-xs text-slate-400 mb-2">Add your own tags</p>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  maxLength={40}
                  className={cn(input, "flex-1")}
                  placeholder="Type a tag and press Enter…"
                />
                <button
                  type="button" onClick={addCustomTag}
                  disabled={!tagInput.trim()}
                  className="px-4 py-2.5 bg-slate-100 text-navy text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Custom tags display */}
            {customTags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {customTags.map(tag => (
                  <span key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-muted text-amber border border-amber/20"
                  >
                    {tag}
                    <button type="button" onClick={() => setCustomTags(p => p.filter(t => t !== tag))}
                      className="text-amber/60 hover:text-amber leading-none ml-0.5"
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Section>

          {/* ── Photos ─────────────────────────────────────────────────── */}
          <Section title="Photos">
            {/* Front + Back slots */}
            <div className="grid grid-cols-2 gap-4">
              <PhotoSlot
                label="Front"
                photo={frontPhoto}
                inputRef={frontInputRef}
                onSelect={() => frontInputRef.current?.click()}
                onRemove={() => clearSlotPhoto("front")}
              />
              <PhotoSlot
                label="Back"
                photo={backPhoto}
                inputRef={backInputRef}
                onSelect={() => backInputRef.current?.click()}
                onRemove={() => clearSlotPhoto("back")}
              />
            </div>

            {/* Hidden inputs for front/back */}
            <input ref={frontInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => setSlotPhoto("front", e.target.files?.[0] ?? null)} />
            <input ref={backInputRef}  type="file" accept="image/*" className="hidden"
              onChange={e => setSlotPhoto("back",  e.target.files?.[0] ?? null)} />

            {/* Additional photos — collapsed by default */}
            <div className="border-t border-slate-100 pt-3">
              <button
                type="button" onClick={() => setAdditionalOpen(o => !o)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-navy transition-colors"
              >
                <ChevronDown className={cn("w-4 h-4 transition-transform", additionalOpen && "rotate-180")} />
                {additionalOpen ? "Hide" : "Add"} additional photos
                {additionalPhotos.length > 0 && (
                  <span className="bg-brand text-white text-xs px-1.5 py-0.5 rounded-full">{additionalPhotos.length}</span>
                )}
              </button>

              {additionalOpen && (
                <div className="mt-3 flex flex-col gap-3">
                  {additionalPhotos.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {additionalPhotos.map((p, i) => (
                        <div key={i} className="relative group" style={{ aspectRatio: "2.5/3.5" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.preview} alt={`Photo ${i + 3}`}
                            className="w-full h-full object-cover rounded-lg" />
                          <button type="button" onClick={() => removeAdditional(i)}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {additionalPhotos.length < 10 && (
                    <button type="button" onClick={() => addlInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-brand hover:text-brand transition-colors"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add photos ({10 - additionalPhotos.length} remaining)
                    </button>
                  )}
                  <input ref={addlInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => addAdditional(e.target.files)} />
                </div>
              )}
            </div>

            <p className="text-slate-400 text-xs">
              JPG, PNG, or WEBP · max 10 MB per photo
            </p>
          </Section>

          {/* ── Acquisition (collapsible) ───────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <button type="button" onClick={() => setAcqOpen(!acqOpen)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <div>
                <p className="text-navy text-sm font-semibold">Acquisition info</p>
                <p className="text-slate-400 text-xs mt-0.5">Optional — date, price paid, source</p>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", acqOpen && "rotate-180")} />
            </button>
            {acqOpen && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date acquired">
                    <input type="date" value={form.acquiredDate}
                      onChange={e => setField("acquiredDate", e.target.value)} className={input} />
                  </Field>
                  <Field label="Price paid ($)">
                    <input type="number" min={0} step="0.01" value={form.acquiredPrice}
                      onChange={e => setField("acquiredPrice", e.target.value)}
                      className={input} placeholder="0.00" />
                  </Field>
                </div>
                <Field label="Source">
                  <select value={form.acquiredSource}
                    onChange={e => setField("acquiredSource", e.target.value)} className={input}>
                    <option value="">Select source</option>
                    {ACQ_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>

          {/* ── Action buttons ──────────────────────────────────────────── */}
          <div className="flex gap-3 pt-2 pb-8">
            <Link
              href={collection ? `/dashboard/collections/${collection.id}` : "/dashboard"}
              className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
            <button type="button" disabled={isPending} onClick={() => doSave(true)}
              className="flex-1 sm:flex-none px-5 py-2.5 border border-brand text-brand text-sm font-semibold rounded-xl hover:bg-brand-muted transition-colors disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save & add another"}
            </button>
            <button type="button" disabled={isPending} onClick={() => doSave(false)}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-amber text-amber-dark text-sm font-semibold rounded-xl hover:brightness-105 transition-all disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save card →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PhotoSlot ────────────────────────────────────────────────────────────────

function PhotoSlot({
  label, photo, inputRef, onSelect, onRemove,
}: {
  label: string;
  photo: PhotoPreview | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative" style={{ aspectRatio: "2.5/3.5" }}>
      {photo ? (
        <div className="w-full h-full relative rounded-xl overflow-hidden group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.preview} alt={label} className="w-full h-full object-cover" />
          {/* Label + remove bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-6 pb-2 px-3 flex items-center justify-between">
            <span className="text-white text-xs font-semibold">{label}</span>
            <button type="button" onClick={onRemove}
              className="text-white/70 hover:text-white text-sm leading-none"
              aria-label={`Remove ${label} photo`}
            >
              ×
            </button>
          </div>
          {/* Click to replace */}
          <button type="button" onClick={onSelect}
            className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/20 flex items-center justify-center transition-opacity"
            aria-label={`Replace ${label} photo`}
          >
            <span className="bg-white/90 text-navy text-xs font-semibold px-3 py-1.5 rounded-lg">Replace</span>
          </button>
        </div>
      ) : (
        <button type="button" onClick={onSelect}
          className="w-full h-full border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1.5 hover:border-brand hover:bg-slate-50 transition-colors group"
        >
          <CameraIcon className="w-7 h-7 text-slate-300 group-hover:text-brand transition-colors" />
          <span className="text-navy text-sm font-semibold">{label}</span>
          <span className="text-slate-400 text-xs">Click to add</span>
        </button>
      )}
    </div>
  );
}

// ─── Layout helpers ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-navy mb-1.5">
        {label}{required && <span className="text-alert ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const input = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition bg-white";

// ─── SlabScanner ──────────────────────────────────────────────────────────────

const GRADERS = ["PSA","BGS","SGC","CGC","HGA"];

function ResultCard({ result, onUse, onReset }: {
  result: GraderCardData;
  onUse: () => void;
  onReset: () => void;
}) {
  return (
    <div className="bg-green-50 border border-green-100 rounded-xl p-4">
      <p className="text-success font-semibold text-sm mb-1">
        ✓ {result.grader} cert #{result.certNumber}
      </p>
      {result.player && <p className="text-navy font-bold text-lg">{result.player}</p>}
      {(result.year || result.manufacturer || result.set) && (
        <p className="text-slate-500 text-sm mt-0.5">
          {[result.year, result.manufacturer, result.set].filter(Boolean).join(" · ")}
        </p>
      )}
      {result.grade && (
        <p className="text-navy text-sm font-medium mt-0.5">{result.grader} {result.grade}</p>
      )}
      {!result.player && (
        <p className="text-slate-400 text-xs mt-2">
          Cert found — add PSA credentials in Settings → API Keys for full card details.
        </p>
      )}
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={onUse}
          className="flex-1 bg-amber text-amber-dark font-semibold py-2.5 rounded-xl text-sm hover:brightness-105 transition-all">
          Use this data →
        </button>
        <button type="button" onClick={onReset}
          className="px-4 py-2.5 border border-slate-200 text-slate-500 text-sm rounded-xl hover:bg-slate-50 transition-colors">
          Try again
        </button>
      </div>
    </div>
  );
}

function SlabScanner({ onDetected }: { onDetected: (data: GraderCardData) => void }) {
  // Manual cert entry state
  const [certInput,    setCertInput]    = useState("");
  const [graderInput,  setGraderInput]  = useState("PSA");
  const [certLoading,  setCertLoading]  = useState(false);
  const [certError,    setCertError]    = useState("");
  const [certResult,   setCertResult]   = useState<GraderCardData | null>(null);

  // Photo scan state
  const [image,        setImage]        = useState<File | null>(null);
  const [preview,      setPreview]      = useState<string | null>(null);
  const [scanning,     setScanning]     = useState(false);
  const [scanError,    setScanError]    = useState("");
  const [scanResult,   setScanResult]   = useState<GraderCardData | null>(null);
  const [rawText,      setRawText]      = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Manual cert lookup ──────────────────────────────────────────────────────
  async function doManualLookup() {
    const cert = certInput.trim();
    if (!cert) return;
    setCertLoading(true); setCertError(""); setCertResult(null);
    try {
      const res  = await fetch(`/api/cert?cert=${encodeURIComponent(cert)}&grader=${graderInput}`);
      const data = await res.json();
      if (!res.ok || !data.success) setCertError(data.error ?? "Lookup failed.");
      else setCertResult(data.cardData);
    } catch {
      setCertError("Network error. Please try again.");
    } finally {
      setCertLoading(false);
    }
  }

  // ── Photo scan ──────────────────────────────────────────────────────────────
  function pickImage(file: File) {
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setScanResult(null); setScanError(""); setRawText(null);
  }

  async function doScan() {
    if (!image) return;
    setScanning(true); setScanError("");
    const fd = new FormData();
    fd.append("image", image);
    try {
      const res  = await fetch("/api/scan", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setScanError(data.error ?? "Scan failed.");
        setRawText(data.rawText ?? null);
      } else {
        setScanResult(data.cardData);
        setRawText(data.rawText ?? null);
      }
    } catch {
      setScanError("Network error. Please try again.");
    } finally {
      setScanning(false);
    }
  }

  function resetScan() {
    if (preview) URL.revokeObjectURL(preview);
    setImage(null); setPreview(null);
    setScanResult(null); setScanError(""); setRawText(null);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col gap-6">

      {/* ── Manual cert entry (primary path — fastest) ───────────────────── */}
      <div>
        <p className="text-navy font-semibold mb-1">Enter cert number</p>
        <p className="text-slate-400 text-sm mb-3">
          Type the cert number from the slab label for an instant lookup.
        </p>
        <div className="flex gap-2">
          <select value={graderInput} onChange={e => setGraderInput(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/40 bg-white shrink-0">
            {GRADERS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <input
            value={certInput} onChange={e => setCertInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doManualLookup()}
            placeholder="e.g. 80239626"
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
          />
          <button type="button" onClick={doManualLookup}
            disabled={!certInput.trim() || certLoading}
            className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-light-navy transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0">
            {certLoading ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : null}
            Look up
          </button>
        </div>
        {certError && <p className="text-alert text-xs mt-2">{certError}</p>}
        {certResult && (
          <div className="mt-3">
            <ResultCard result={certResult} onUse={() => onDetected(certResult)} onReset={() => setCertResult(null)} />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-slate-300 text-xs">or scan a photo</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>

      {/* ── Photo scan (OCR path) ────────────────────────────────────────── */}
      <div>
        <p className="text-navy font-semibold mb-1">Scan the slab label</p>
        <p className="text-slate-400 text-sm mb-3">
          Photograph the cert label. OCR reads the cert number automatically.
          {" "}<span className="text-slate-300">(First scan downloads language data — may take 30s)</span>
        </p>

        {!image ? (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-200 rounded-xl py-8 flex flex-col items-center gap-2 hover:border-brand hover:bg-slate-50 transition-colors">
            <ScannerIcon className="w-8 h-8 text-slate-300" />
            <p className="text-navy font-medium text-sm">Take or upload a photo</p>
            <p className="text-slate-400 text-xs">Crop to the label area for best results</p>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl overflow-hidden bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview!} alt="Slab" className="w-full max-h-52 object-contain" />
            </div>

            {scanError && (
              <div className="bg-red-50 border border-red-100 text-alert text-sm rounded-xl px-4 py-3">
                {scanError}
                {rawText && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-slate-400">Show OCR text</summary>
                    <pre className="text-xs mt-1 text-slate-500 whitespace-pre-wrap break-words">{rawText}</pre>
                  </details>
                )}
              </div>
            )}

            {scanResult && (
              <ResultCard result={scanResult} onUse={() => onDetected(scanResult)} onReset={resetScan} />
            )}

            {!scanResult && (
              <div className="flex gap-2">
                <button type="button" onClick={doScan} disabled={scanning}
                  className="flex-1 bg-brand text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-light-navy transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {scanning && <SpinnerIcon className="w-4 h-4 animate-spin" />}
                  {scanning ? "Reading slab…" : "Scan this image"}
                </button>
                <button type="button" onClick={resetScan}
                  className="px-4 py-2.5 border border-slate-200 text-slate-500 text-sm rounded-xl hover:bg-slate-50 transition-colors">
                  Change photo
                </button>
              </div>
            )}
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          className="hidden"
          onChange={e => { if (e.target.files?.[0]) pickImage(e.target.files[0]); }} />
      </div>

      <p className="text-slate-300 text-xs text-center">Supports PSA · BGS · SGC · CGC · HGA</p>
    </div>
  );
}

function ScannerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
      <rect x="7" y="7" width="10" height="10" rx="1"/>
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────────────
// (The old ScannerIcon and SpinnerIcon blocks that used to be here are now above)
// ─── Icons ─────────────────────────────────────────────────────────────────────

function ChevronLeft({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>;
}
function ChevronDown({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>;
}
function CameraIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
