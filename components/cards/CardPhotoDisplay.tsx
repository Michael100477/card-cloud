"use client";

import { useState, useEffect, useCallback } from "react";

interface Props {
  photos: string[];
  player: string;
  manufacturer: string;
  year: number;
  set: string;
  subset: string | null;
  grade: string | null;
  gradeCompany: string | null;
  serialNumber: string | null;
  gradeBg: string;
  gradient: [string, string];
}

const LABELS = ["Front", "Back"];
function label(i: number) { return LABELS[i] ?? `Photo ${i + 1}`; }

export function CardPhotoDisplay({
  photos, player, manufacturer, year, set, subset,
  grade, gradeCompany, serialNumber, gradeBg, gradient,
}: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft")  setLightboxIndex(i => (i !== null && i > 0 ? i - 1 : i));
      if (e.key === "ArrowRight") setLightboxIndex(i => (i !== null && i < photos.length - 1 ? i + 1 : i));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxIndex, photos.length, closeLightbox]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function open(i: number) { setLightboxIndex(i); }

  const GradeBadge = ({ size = "sm" }: { size?: "sm" | "xs" }) =>
    grade ? (
      <div
        className="absolute top-2 right-2 text-white font-bold rounded-full px-2 py-0.5 shadow-md"
        style={{ background: gradeBg, fontSize: size === "sm" ? "11px" : "9px" }}
      >
        {gradeCompany} {grade}
      </div>
    ) : null;

  const Label = ({ i }: { i: number }) => (
    <div className="absolute bottom-2 left-2 bg-black/55 text-white text-xs px-2 py-0.5 rounded font-medium">
      {label(i)}
    </div>
  );

  // ── Photo cases ───────────────────────────────────────────────────────────

  return (
    <>
      {/* 0 photos — gradient placeholder */}
      {photos.length === 0 && (
        <div
          className="w-full shadow-md"
          style={{ aspectRatio: "2.5/3.5", background: `linear-gradient(145deg, ${gradient[0]}, ${gradient[1]})` }}
        >
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-4">{manufacturer} · {year}</p>
            <p className="text-white font-bold text-xl leading-tight mb-2">{player}</p>
            <p className="text-white/60 text-sm">{set}{subset ? ` · ${subset}` : ""}</p>
            {grade && (
              <div className="mt-6 px-3 py-1.5 rounded-full text-white text-xs font-bold" style={{ background: gradeBg }}>
                {gradeCompany} {grade}
              </div>
            )}
            {serialNumber && <p className="text-white/50 text-xs mt-3 font-mono">{serialNumber}</p>}
          </div>
        </div>
      )}

      {/* 1 photo — full width */}
      {photos.length === 1 && (
        <button
          onClick={() => open(0)}
          className="relative w-full shadow-md overflow-hidden cursor-zoom-in group"
          style={{ aspectRatio: "2.5/3.5" }}
          aria-label="View full size"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[0]} alt="Front" className="w-full h-full object-cover" />
          <GradeBadge />
          <Label i={0} />
          <ZoomHint />
        </button>
      )}

      {/* 2+ photos — front + back side by side */}
      {photos.length >= 2 && (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map(i => (
            <button
              key={i}
              onClick={() => open(i)}
              className="relative shadow-sm overflow-hidden cursor-zoom-in group"
              style={{ aspectRatio: "2.5/3.5" }}
              aria-label={`View ${label(i)} full size`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[i]} alt={label(i)} className="w-full h-full object-cover" />
              {i === 0 && <GradeBadge size="xs" />}
              <Label i={i} />
              <ZoomHint />
            </button>
          ))}
        </div>
      )}

      {/* Additional photos (3+) */}
      {photos.length > 2 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.slice(2).map((url, i) => (
            <button
              key={i}
              onClick={() => open(i + 2)}
              className="relative overflow-hidden cursor-zoom-in group"
              style={{ aspectRatio: "2.5/3.5" }}
              aria-label={`View photo ${i + 3} full size`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Photo ${i + 3}`} className="w-full h-full object-cover" />
              <ZoomHint small />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}

// ─── Zoom hint overlay ────────────────────────────────────────────────────────

function ZoomHint({ small = false }: { small?: boolean }) {
  return (
    <div className={`absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center`}>
      <div className={`opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full ${small ? "p-1" : "p-2"}`}>
        <MagnifyIcon className={small ? "w-3 h-3" : "w-4 h-4"} />
      </div>
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  photos, index, onClose, onNavigate,
}: {
  photos: string[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
        aria-label="Close"
      >
        <CloseIcon className="w-5 h-5" />
      </button>

      {/* Label */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/10 text-white text-sm font-medium px-4 py-1.5 rounded-full">
        {label(index)}{photos.length > 1 ? ` · ${index + 1} / ${photos.length}` : ""}
      </div>

      {/* Image — stop propagation so clicking the image doesn't close */}
      <div
        className="relative max-w-[92vw] max-h-[88vh] flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[index]}
          alt={label(index)}
          className="max-w-full max-h-[88vh] object-contain shadow-2xl"
          style={{ imageRendering: "auto" }}
        />
      </div>

      {/* Prev arrow */}
      {hasPrev && (
        <button
          onClick={e => { e.stopPropagation(); onNavigate(index - 1); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Previous photo"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
      )}

      {/* Next arrow */}
      {hasNext && (
        <button
          onClick={e => { e.stopPropagation(); onNavigate(index + 1); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Next photo"
        >
          <ChevronRightIcon className="w-6 h-6" />
        </button>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); onNavigate(i); }}
              className={`w-2 h-2 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/30"}`}
              aria-label={`Go to ${label(i)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function MagnifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  );
}
function CloseIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function ChevronLeftIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>;
}
function ChevronRightIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>;
}
