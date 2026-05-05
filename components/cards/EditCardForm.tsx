"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateCardAction } from "@/lib/actions/cards";
import { cn } from "@/lib/utils";

// ─── Constants (same as AddCardForm) ─────────────────────────────────────────

const SPORTS = ["Baseball","Football","Basketball","Hockey","Soccer","Golf","Tennis","Boxing","MMA","NASCAR","Pokémon","Magic: The Gathering","Yu-Gi-Oh!","Other"];
const MANUFACTURERS = ["Topps","Panini","Upper Deck","Bowman","Fleer","Donruss","Score","Leaf","Pacific","O-Pee-Chee","Stadium Club","Select","Prizm","Chrome","Finest","SPx"];
const GRADE_COMPANIES = ["PSA","BGS","BGGS","BCCG","SGC","CGC","HGA","Other"];
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

export interface InitialCard {
  id: string;
  player: string;
  year: number;
  manufacturer: string;
  set: string;
  subset: string;
  cardNumber: string;
  serialNumber: string;
  sport: string;
  team: string;
  gradeCompany: string;
  grade: string;
  certNumber: string;
  tags: string[];
  conditionNotes: string;
  notes: string;
  photos: string[];         // existing URLs already saved in DB
  acquiredDate: string;
  acquiredPrice: string;
  acquiredSource: string;
}

// A photo slot can hold either an existing saved URL or a brand-new local File
interface PhotoSlotState {
  existingUrl: string | null;   // URL already in DB — keep unless replaced
  file: File | null;            // new file picked by user
  preview: string | null;       // local blob URL for preview, or existingUrl
}

function makeSlot(url?: string): PhotoSlotState {
  return { existingUrl: url ?? null, file: null, preview: url ?? null };
}

interface Props {
  initial: InitialCard;
  collection: { id: string; name: string } | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditCardForm({ initial, collection }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Form fields ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    player:        initial.player,
    year:          String(initial.year),
    manufacturer:  initial.manufacturer,
    set:           initial.set,
    subset:        initial.subset,
    cardNumber:    initial.cardNumber,
    serialNumber:  initial.serialNumber,
    sport:         initial.sport,
    team:          initial.team,
    gradeCompany:  initial.gradeCompany,
    grade:         initial.grade,
    certNumber:    initial.certNumber,
    notes:         initial.notes,
    conditionNotes: initial.conditionNotes,
    acquiredDate:  initial.acquiredDate,
    acquiredPrice: initial.acquiredPrice,
    acquiredSource: initial.acquiredSource,
  });

  // ── Tags ────────────────────────────────────────────────────────────────────
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initial.tags.filter(t => PRESET_TAGS.includes(t))
  );
  const [customTags, setCustomTags] = useState<string[]>(
    initial.tags.filter(t => !PRESET_TAGS.includes(t))
  );
  const [tagInput, setTagInput] = useState("");

  // ── Photos ──────────────────────────────────────────────────────────────────
  // Slot 0 = front, slot 1 = back, rest = additional
  const [frontSlot,       setFrontSlot]       = useState<PhotoSlotState>(makeSlot(initial.photos[0]));
  const [backSlot,        setBackSlot]        = useState<PhotoSlotState>(makeSlot(initial.photos[1]));
  const [additionalSlots, setAdditionalSlots] = useState<PhotoSlotState[]>(
    initial.photos.slice(2).map(url => makeSlot(url))
  );
  const [additionalOpen, setAdditionalOpen] = useState(initial.photos.length > 2);

  // ── Misc ────────────────────────────────────────────────────────────────────
  const [acqOpen,    setAcqOpen]    = useState(
    !!(initial.acquiredDate || initial.acquiredPrice || initial.acquiredSource)
  );
  const [error,      setError]      = useState("");

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef  = useRef<HTMLInputElement>(null);
  const addlInputRef  = useRef<HTMLInputElement>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const setField = (f: keyof typeof form, v: string) => setForm(p => ({ ...p, [f]: v }));

  function togglePreset(tag: string) {
    setSelectedTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag]);
  }

  function addCustomTag() {
    const val = tagInput.trim();
    if (!val || val.length > 40) return;
    const all = [...selectedTags, ...customTags];
    if (all.map(t => t.toLowerCase()).includes(val.toLowerCase())) { setTagInput(""); return; }
    setCustomTags(p => [...p, val]);
    setTagInput("");
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); addCustomTag(); }
  }

  function replaceSlot(
    setter: React.Dispatch<React.SetStateAction<PhotoSlotState>>,
    file: File
  ) {
    const preview = URL.createObjectURL(file);
    setter({ existingUrl: null, file, preview });
  }

  function clearSlot(setter: React.Dispatch<React.SetStateAction<PhotoSlotState>>) {
    setter(prev => {
      if (prev.file) URL.revokeObjectURL(prev.preview!);
      return { existingUrl: null, file: null, preview: null };
    });
  }

  function addAdditional(files: FileList | null) {
    if (!files) return;
    const remaining = 10 - additionalSlots.length;
    const newSlots = Array.from(files).slice(0, remaining).map(f => ({
      existingUrl: null, file: f, preview: URL.createObjectURL(f),
    }));
    setAdditionalSlots(p => [...p, ...newSlots]);
  }

  function removeAdditional(i: number) {
    setAdditionalSlots(p => {
      const slot = p[i];
      if (slot.file) URL.revokeObjectURL(slot.preview!);
      return p.filter((_, idx) => idx !== i);
    });
  }

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "Upload failed"); }
    return (await res.json()).url as string;
  }

  async function resolveSlot(slot: PhotoSlotState): Promise<string | null> {
    if (!slot.preview) return null;           // cleared — don't include
    if (slot.file)     return uploadFile(slot.file);  // new file — upload
    return slot.existingUrl;                  // unchanged — keep existing URL
  }

  function validate() {
    if (!form.player.trim())       return "Player / card name is required.";
    if (!form.year || isNaN(Number(form.year))) return "A valid year is required.";
    if (!form.manufacturer.trim()) return "Manufacturer is required.";
    if (!form.set.trim())          return "Set is required.";
    return null;
  }

  function doSave() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");

    startTransition(async () => {
      // Resolve all photo slots — upload new ones, keep existing URLs
      let photoUrls: (string | null)[];
      try {
        photoUrls = await Promise.all([
          resolveSlot(frontSlot),
          resolveSlot(backSlot),
          ...additionalSlots.map(s => resolveSlot(s)),
        ]);
      } catch (uploadErr) {
        setError(uploadErr instanceof Error ? uploadErr.message : "Photo upload failed.");
        return;
      }

      const result = await updateCardAction(initial.id, {
        player:        form.player,
        year:          Number(form.year),
        manufacturer:  form.manufacturer,
        set:           form.set,
        subset:        form.subset        || undefined,
        cardNumber:    form.cardNumber    || undefined,
        sport:         form.sport         || undefined,
        team:          form.team          || undefined,
        gradeCompany:  form.gradeCompany  || undefined,
        grade:         form.grade         || undefined,
        certNumber:    form.certNumber    || undefined,
        serialNumber:  form.serialNumber  || undefined,
        tags:          [...selectedTags, ...customTags],
        conditionNotes: form.conditionNotes || undefined,
        notes:          form.notes          || undefined,
        photos:        photoUrls.filter((u): u is string => u !== null),
        acquiredDate:   form.acquiredDate   || undefined,
        acquiredPrice:  form.acquiredPrice ? Number(form.acquiredPrice) : undefined,
        acquiredSource: form.acquiredSource || undefined,
      });

      if (result?.error) { setError(result.error); return; }
      router.push(`/dashboard/cards/${initial.id}`);
    });
  }

  const gradeOptions = form.gradeCompany ? GRADE_OPTIONS[form.gradeCompany] : null;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/dashboard/cards/${initial.id}`}
          className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 text-sm mb-3 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to card
        </Link>
        <h1 className="text-navy text-2xl font-bold">Edit card</h1>
        <p className="text-slate-500 text-sm mt-0.5">{initial.player}</p>
      </div>

      <div className="flex flex-col gap-5">
        {error && <div className="bg-red-50 border border-red-100 text-alert text-sm rounded-xl px-4 py-3">{error}</div>}

        {/* ── Card Identity ──────────────────────────────────────────── */}
        <Section title="Card identity">
          <Field label="Player / Card name" required>
            <input value={form.player} onChange={e => setField("player", e.target.value)} className={inp} placeholder="e.g. Mike Trout" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year" required>
              <input value={form.year} onChange={e => setField("year", e.target.value)} type="number" min={1800} max={2099} className={inp} />
            </Field>
            <Field label="Manufacturer" required>
              <input value={form.manufacturer} onChange={e => setField("manufacturer", e.target.value)} list="mfr-list-edit" className={inp} />
              <datalist id="mfr-list-edit">{MANUFACTURERS.map(m => <option key={m} value={m} />)}</datalist>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Set" required>
              <input value={form.set} onChange={e => setField("set", e.target.value)} className={inp} placeholder="e.g. Topps Chrome" />
            </Field>
            <Field label="Subset">
              <input value={form.subset} onChange={e => setField("subset", e.target.value)} className={inp} placeholder="e.g. Refractor" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Card number">
              <input value={form.cardNumber} onChange={e => setField("cardNumber", e.target.value)} className={inp} placeholder="e.g. #179" />
            </Field>
            <Field label="Serial number">
              <input value={form.serialNumber}
                onChange={e => {
                  setField("serialNumber", e.target.value);
                  if (e.target.value.trim() && !selectedTags.includes("Numbered"))
                    setSelectedTags(p => [...p, "Numbered"]);
                }}
                className={inp} placeholder="e.g. 5/10, /25" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sport / Type">
              <select value={form.sport} onChange={e => setField("sport", e.target.value)} className={inp}>
                <option value="">Select sport</option>
                {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Team">
              <input value={form.team} onChange={e => setField("team", e.target.value)} className={inp} placeholder="e.g. LA Angels" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={form.notes} onChange={e => setField("notes", e.target.value)}
              rows={2} className={cn(inp, "resize-none")} placeholder="General notes…" />
          </Field>
          <Field label="Condition notes">
            <textarea value={form.conditionNotes} onChange={e => setField("conditionNotes", e.target.value)}
              rows={2} className={cn(inp, "resize-none")} placeholder="Scratches, creases, observations…" />
          </Field>
        </Section>

        {/* ── Grading ────────────────────────────────────────────────── */}
        <Section title="Grading">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Grade company">
              <select value={form.gradeCompany}
                onChange={e => { setField("gradeCompany", e.target.value); setField("grade", ""); }}
                className={inp}
              >
                <option value="">None / Raw</option>
                {GRADE_COMPANIES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Grade">
              {gradeOptions ? (
                <select value={form.grade} onChange={e => setField("grade", e.target.value)} className={inp}>
                  <option value="">Select grade</option>
                  {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  <option value="Other">Other</option>
                </select>
              ) : (
                <input value={form.grade} onChange={e => setField("grade", e.target.value)}
                  className={inp} placeholder="e.g. 9.5" disabled={!form.gradeCompany} />
              )}
            </Field>
            <Field label="Cert number">
              <input value={form.certNumber} onChange={e => setField("certNumber", e.target.value)} className={inp} placeholder="e.g. 12345678" />
            </Field>
          </div>
        </Section>

        {/* ── Tags ───────────────────────────────────────────────────── */}
        <Section title="Tags">
          <div className="flex flex-wrap gap-2">
            {PRESET_TAGS.map(tag => (
              <button key={tag} type="button" onClick={() => togglePreset(tag)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  selectedTags.includes(tag)
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand"
                )}
              >{tag}</button>
            ))}
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-2">Add your own tags</p>
            <div className="flex gap-2">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown} maxLength={40}
                className={cn(inp, "flex-1")} placeholder="Type a tag and press Enter…" />
              <button type="button" onClick={addCustomTag} disabled={!tagInput.trim()}
                className="px-4 py-2.5 bg-slate-100 text-navy text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-40">
                Add
              </button>
            </div>
          </div>
          {customTags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {customTags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-muted text-amber border border-amber/20">
                  {tag}
                  <button type="button" onClick={() => setCustomTags(p => p.filter(t => t !== tag))}
                    className="text-amber/60 hover:text-amber ml-0.5">×</button>
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* ── Photos ─────────────────────────────────────────────────── */}
        <Section title="Photos">
          <div className="grid grid-cols-2 gap-4">
            <EditPhotoSlot label="Front" slot={frontSlot}
              onReplace={f => replaceSlot(setFrontSlot, f)}
              onClear={() => clearSlot(setFrontSlot)}
              inputRef={frontInputRef} />
            <EditPhotoSlot label="Back" slot={backSlot}
              onReplace={f => replaceSlot(setBackSlot, f)}
              onClear={() => clearSlot(setBackSlot)}
              inputRef={backInputRef} />
          </div>
          <input ref={frontInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { if (e.target.files?.[0]) replaceSlot(setFrontSlot, e.target.files[0]); }} />
          <input ref={backInputRef}  type="file" accept="image/*" className="hidden"
            onChange={e => { if (e.target.files?.[0]) replaceSlot(setBackSlot, e.target.files[0]); }} />

          <div className="border-t border-slate-100 pt-3">
            <button type="button" onClick={() => setAdditionalOpen(o => !o)}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-navy transition-colors"
            >
              <ChevronDown className={cn("w-4 h-4 transition-transform", additionalOpen && "rotate-180")} />
              {additionalOpen ? "Hide" : "Add"} additional photos
              {additionalSlots.length > 0 && (
                <span className="bg-brand text-white text-xs px-1.5 py-0.5 rounded-full">{additionalSlots.length}</span>
              )}
            </button>

            {additionalOpen && (
              <div className="mt-3 flex flex-col gap-3">
                {additionalSlots.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {additionalSlots.map((s, i) => s.preview ? (
                      <div key={i} className="relative group" style={{ aspectRatio: "2.5/3.5" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.preview} alt={`Photo ${i+3}`} className="w-full h-full object-cover rounded-lg" />
                        <button type="button" onClick={() => removeAdditional(i)}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs">×</button>
                      </div>
                    ) : null)}
                  </div>
                )}
                {additionalSlots.length < 10 && (
                  <button type="button" onClick={() => addlInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-brand hover:text-brand transition-colors">
                    <PlusIcon className="w-4 h-4" /> Add photos ({10 - additionalSlots.length} remaining)
                  </button>
                )}
                <input ref={addlInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => addAdditional(e.target.files)} />
              </div>
            )}
          </div>
          <p className="text-slate-400 text-xs">JPG, PNG, or WEBP · max 10 MB per photo</p>
        </Section>

        {/* ── Acquisition ────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <button type="button" onClick={() => setAcqOpen(!acqOpen)}
            className="w-full flex items-center justify-between px-5 py-4 text-left">
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
                  <input type="date" value={form.acquiredDate} onChange={e => setField("acquiredDate", e.target.value)} className={inp} />
                </Field>
                <Field label="Price paid ($)">
                  <input type="number" min={0} step="0.01" value={form.acquiredPrice} onChange={e => setField("acquiredPrice", e.target.value)} className={inp} placeholder="0.00" />
                </Field>
              </div>
              <Field label="Source">
                <select value={form.acquiredSource} onChange={e => setField("acquiredSource", e.target.value)} className={inp}>
                  <option value="">Select source</option>
                  {ACQ_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>

        {/* ── Buttons ────────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-2 pb-8">
          <Link href={`/dashboard/cards/${initial.id}`}
            className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            Cancel
          </Link>
          <button type="button" disabled={isPending} onClick={doSave}
            className="flex-1 bg-amber text-amber-dark text-sm font-semibold py-2.5 rounded-xl hover:brightness-105 transition-all disabled:opacity-60">
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EditPhotoSlot ─────────────────────────────────────────────────────────────

function EditPhotoSlot({
  label, slot, onReplace, onClear, inputRef,
}: {
  label: string;
  slot: PhotoSlotState;
  onReplace: (f: File) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const hasPhoto = !!slot.preview;
  return (
    <div className="relative" style={{ aspectRatio: "2.5/3.5" }}>
      {hasPhoto ? (
        <div className="w-full h-full relative rounded-xl overflow-hidden group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slot.preview!} alt={label} className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-6 pb-2 px-3 flex items-center justify-between">
            <span className="text-white text-xs font-semibold">{label}</span>
            <button type="button" onClick={onClear} className="text-white/70 hover:text-white text-sm" aria-label={`Remove ${label}`}>×</button>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()}
            className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/20 flex items-center justify-center transition-opacity">
            <span className="bg-white/90 text-navy text-xs font-semibold px-3 py-1.5 rounded-lg">Replace</span>
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full h-full border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1.5 hover:border-brand hover:bg-slate-50 transition-colors group">
          <CameraIcon className="w-7 h-7 text-slate-300 group-hover:text-brand transition-colors" />
          <span className="text-navy text-sm font-semibold">{label}</span>
          <span className="text-slate-400 text-xs">Click to add</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files?.[0]) onReplace(e.target.files[0]); }} />
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

const inp = "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition bg-white";

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
