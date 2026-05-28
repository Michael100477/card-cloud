"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface User {
  id: string; displayName: string | null; username: string | null;
  profilePhoto: string | null; bio: string | null; location: string | null;
  email: string; cardCount: number; followerCount: number; followingCount: number;
  fullName: string | null;
  phone: string | null; addressLine1: string | null; addressLine2: string | null;
  city: string | null; state: string | null; zip: string | null; country: string | null;
}

// ── Crop modal ────────────────────────────────────────────────────────────────

const CIRCLE = 256; // display size of the crop circle in px

function CropModal({ file, onApply, onCancel }: {
  file: File;
  onApply: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [src,     setSrc]     = useState("");
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [scale,   setScale]   = useState(1);
  const [offset,  setOffset]  = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setNatural({ w, h });
    const s = CIRCLE / Math.min(w, h);
    setScale(s);
    setOffset({ x: 0, y: 0 });
  }

  function clamp(ox: number, oy: number, sc: number) {
    if (!natural.w) return { x: ox, y: oy };
    const dw = natural.w * sc;
    const dh = natural.h * sc;
    const mx = Math.max(0, (dw - CIRCLE) / 2);
    const my = Math.max(0, (dh - CIRCLE) / 2);
    return { x: Math.max(-mx, Math.min(mx, ox)), y: Math.max(-my, Math.min(my, oy)) };
  }

  // Mouse drag
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      setOffset(clamp(d.ox + e.clientX - d.sx, d.oy + e.clientY - d.sy, scale));
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, natural]);

  // Touch drag
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    dragRef.current = { sx: t.clientX, sy: t.clientY, ox: offset.x, oy: offset.y };
  }
  function onTouchMove(e: React.TouchEvent) {
    const d = dragRef.current;
    if (!d) return;
    const t = e.touches[0];
    setOffset(clamp(d.ox + t.clientX - d.sx, d.oy + t.clientY - d.sy, scale));
  }

  function setScaleAndClamp(s: number) {
    setScale(s);
    setOffset(o => clamp(o.x, o.y, s));
  }

  function apply() {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = CIRCLE;
      canvas.height = CIRCLE;
      const ctx = canvas.getContext("2d")!;
      const dw = natural.w * scale;
      const dh = natural.h * scale;
      ctx.drawImage(img, CIRCLE / 2 - dw / 2 + offset.x, CIRCLE / 2 - dh / 2 + offset.y, dw, dh);
      canvas.toBlob(blob => { if (blob) onApply(blob); }, "image/jpeg", 0.92);
    };
    img.src = src;
  }

  const minScale = natural.w ? CIRCLE / Math.min(natural.w, natural.h) : 1;
  const dw = natural.w * scale;
  const dh = natural.h * scale;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-navy font-bold">Position photo</h2>
            <p className="text-slate-400 text-xs mt-0.5">Drag to reposition · slider to zoom</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-navy p-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Circle preview — draggable */}
        <div
          className="relative mx-auto overflow-hidden rounded-full select-none cursor-grab active:cursor-grabbing ring-4 ring-brand/20"
          style={{ width: CIRCLE, height: CIRCLE }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={() => { dragRef.current = null; }}
        >
          {src && (
            <img
              src={src}
              alt=""
              draggable={false}
              onLoad={onLoad}
              style={{
                position:      "absolute",
                width:         dw,
                height:        dh,
                left:          CIRCLE / 2 - dw / 2 + offset.x,
                top:           CIRCLE / 2 - dh / 2 + offset.y,
                pointerEvents: "none",
                userSelect:    "none",
              }}
            />
          )}
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></svg>
          <input
            type="range"
            min={minScale}
            max={minScale * 3}
            step={0.01}
            value={scale}
            onChange={e => setScaleAndClamp(Number(e.target.value))}
            className="flex-1 accent-brand"
          />
          <svg className="w-5 h-5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></svg>
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={apply}
            className="flex-1 bg-brand text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-600 transition-colors">
            Apply photo
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main profile client ───────────────────────────────────────────────────────

export function OwnProfileClient({ user }: { user: User }) {
  const [displayName,  setDisplayName]  = useState(user.displayName ?? "");
  const [bio,          setBio]          = useState(user.bio ?? "");
  const [location,     setLocation]     = useState(user.location ?? "");
  const [profilePhoto, setProfilePhoto] = useState(user.profilePhoto ?? "");
  const [phone,        setPhone]        = useState(user.phone ?? "");
  const [addressLine1, setAddressLine1] = useState(user.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(user.addressLine2 ?? "");
  const [city,         setCity]         = useState(user.city ?? "");
  const [state,        setState]        = useState(user.state ?? "");
  const [zip,          setZip]          = useState(user.zip ?? "");
  const [country,      setCountry]      = useState(user.country ?? "United States");
  const [fullName,     setFullName]     = useState(user.fullName ?? "");
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [error,        setError]        = useState("");
  const [pendingFile,  setPendingFile]  = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const name = user.displayName ?? user.username ?? "Collector";
  const inp  = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30";

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    if (e.target) e.target.value = "";
  }

  async function handleCropApply(blob: Blob) {
    setPendingFile(null);
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], "profile.jpg", { type: "image/jpeg" }));
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (r.ok) {
        const { url } = await r.json();
        setProfilePhoto(url);
      } else {
        const d = await r.json();
        setError(d.error ?? "Upload failed");
      }
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true); setError("");
    const r = await fetch(`/api/profile`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName:  displayName  || null,
        bio:          bio          || null,
        location:     location     || null,
        profilePhoto: profilePhoto || null,
        fullName:     fullName     || null,
        phone:        phone        || null,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city:         city         || null,
        state:        state        || null,
        zip:          zip          || null,
        country:      country      || null,
      }),
    });
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else { const d = await r.json(); setError(d.error ?? "Failed to save"); }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Crop modal — shown when a file is selected but not yet uploaded */}
      {pendingFile && (
        <CropModal
          file={pendingFile}
          onApply={handleCropApply}
          onCancel={() => setPendingFile(null)}
        />
      )}

      {/* Avatar preview + stats */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand/10 overflow-hidden flex items-center justify-center shrink-0">
          {profilePhoto
            ? <img src={profilePhoto} alt={name} className="w-full h-full object-cover" />
            : <span className="text-brand text-2xl font-bold">{name[0]?.toUpperCase()}</span>
          }
        </div>
        <div>
          <p className="text-navy font-bold text-lg">{name}</p>
          {user.username && <p className="text-slate-400 text-sm">@{user.username}</p>}
          <div className="flex gap-4 text-xs text-slate-400 mt-1">
            <span><strong className="text-navy">{user.cardCount}</strong> cards</span>
            <span><strong className="text-navy">{user.followerCount}</strong> followers</span>
            <span><strong className="text-navy">{user.followingCount}</strong> following</span>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-4">
        <h2 className="text-navy font-semibold">Edit profile</h2>

        {/* Profile photo upload — avatar is clickable */}
        <div>
          <label className="text-slate-400 text-xs mb-2 block">Profile photo</label>
          <div className="flex items-center gap-4">
            {/* Clickable avatar */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="relative w-20 h-20 rounded-full bg-brand/10 overflow-hidden flex items-center justify-center shrink-0 border-2 border-slate-100 hover:border-brand transition-colors group disabled:opacity-50"
              title="Click to change photo"
            >
              {profilePhoto
                ? <img src={profilePhoto} alt="Preview" className="w-full h-full object-cover" />
                : <span className="text-brand text-3xl font-bold">{name[0]?.toUpperCase()}</span>
              }
              {/* Camera overlay on hover */}
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              {uploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />

            <div className="flex flex-col gap-1.5">
              <p className="text-slate-500 text-sm">
                {uploading ? "Uploading…" : "Click the circle to upload a new photo."}
              </p>
              <p className="text-slate-400 text-xs">You can drag to reposition and zoom after selecting.</p>
              {profilePhoto && (
                <button
                  type="button"
                  onClick={() => setProfilePhoto("")}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors text-left"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="text-slate-400 text-xs mb-1 block">Display name</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder={user.username ?? "Your name"} className={inp} />
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)}
            rows={3} placeholder="Tell collectors about yourself…"
            className={inp + " resize-none"} />
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Location</label>
          <input value={location} onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Hartford, CT" className={inp} />
        </div>

        {/* Contact & return address */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
          <div>
            <p className="text-navy text-sm font-semibold">Contact & return address</p>
            <p className="text-slate-400 text-xs mt-0.5">Appears on consignment packing slips and used for return shipments.</p>
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Full name <span className="text-slate-300">(legal name)</span></label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Michael Anderson" className={inp} />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Phone number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="e.g. (860) 555-0123" className={inp} />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Address line 1</label>
            <input value={addressLine1} onChange={e => setAddressLine1(e.target.value)}
              placeholder="Street address" className={inp} />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Address line 2</label>
            <input value={addressLine2} onChange={e => setAddressLine2(e.target.value)}
              placeholder="Apt, suite, unit (optional)" className={inp} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="text-slate-400 text-xs mb-1 block">City</label>
              <input value={city} onChange={e => setCity(e.target.value)}
                placeholder="City" className={inp} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">State</label>
              <input value={state} onChange={e => setState(e.target.value)}
                placeholder="e.g. CT" maxLength={2} className={inp} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">ZIP</label>
              <input value={zip} onChange={e => setZip(e.target.value)}
                placeholder="00000" className={inp} />
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Country</label>
            <input value={country} onChange={e => setCountry(e.target.value)}
              placeholder="United States" className={inp} />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving || uploading}
            className="bg-brand text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-600 disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="text-green-600 text-sm">✓ Saved</span>}
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="text-navy font-semibold mb-3">Your public feed</h2>
        <p className="text-slate-400 text-sm mb-3">
          Share cards from your collection or post photos directly from your feed.
        </p>
        {user.username && (
          <Link href={`/u/${user.username}`} target="_blank"
            className="text-brand text-sm font-medium hover:underline">
            View your public profile →
          </Link>
        )}
      </div>

      {/* Danger zone */}
      <DangerZone />
    </div>
  );
}

function DangerZone() {
  const [open,     setOpen]     = useState(false);
  const [confirm,  setConfirm]  = useState("");
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function deleteAccount() {
    if (confirm !== "DELETE") return;
    setDeleting(true);
    await fetch("/api/profile", { method: "DELETE" });
    router.push("/");
  }

  return (
    <div className="bg-white rounded-2xl border border-red-100 p-5">
      <h2 className="text-red-600 font-semibold mb-1">Danger zone</h2>
      <p className="text-slate-400 text-sm mb-4">
        Permanently delete your account and all your data — cards, collections, comments, watchlist, and everything else. This cannot be undone.
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="border border-red-200 text-red-500 text-sm font-medium px-4 py-2 rounded-xl hover:bg-red-50 transition-colors">
          Delete my account
        </button>
      ) : (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-red-700 text-sm font-semibold mb-2">
            Are you absolutely sure? Type <strong>DELETE</strong> to confirm.
          </p>
          <input
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-red-300 mb-3 bg-white"
          />
          <div className="flex gap-2">
            <button
              onClick={deleteAccount}
              disabled={confirm !== "DELETE" || deleting}
              className="flex-1 bg-red-600 text-white font-semibold text-sm py-2 rounded-xl hover:bg-red-700 disabled:opacity-40 transition-colors"
            >
              {deleting ? "Deleting…" : "Yes, permanently delete my account"}
            </button>
            <button onClick={() => { setOpen(false); setConfirm(""); }}
              className="px-4 border border-slate-200 text-slate-500 text-sm rounded-xl hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
