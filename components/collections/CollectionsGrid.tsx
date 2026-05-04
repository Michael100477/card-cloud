"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CreateCollectionModal } from "./CreateCollectionModal";
import { setCollectionCoverAction } from "@/lib/actions/collections";

interface CardPreview {
  card: { photos: string[]; player: string };
}

interface CollectionData {
  id: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  isPublic: boolean;
  _count: { cards: number };
  cards: CardPreview[];
}

export function CollectionsGrid({ collections }: { collections: CollectionData[] }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <CreateCollectionModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {collections.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-brand-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CollectionIcon className="w-8 h-8 text-brand" />
          </div>
          <h2 className="text-navy text-lg font-bold mb-2">No collections yet</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
            Collections are how you organize your cards. Create your first one to get started.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-amber text-amber-dark font-semibold px-6 py-2.5 rounded-xl text-sm hover:brightness-105 transition-all"
          >
            Create your first collection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {collections.map((col) => (
            <CollectionCard key={col.id} collection={col} />
          ))}

          {/* + New collection tile */}
          <button
            onClick={() => setModalOpen(true)}
            className="bg-white rounded-2xl border-2 border-dashed border-slate-200 min-h-[200px] flex flex-col items-center justify-center gap-2 hover:border-brand hover:bg-brand-muted/30 transition-all duration-200 group"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-brand/10 flex items-center justify-center transition-colors">
              <PlusIcon className="w-5 h-5 text-slate-400 group-hover:text-brand transition-colors" />
            </div>
            <span className="text-slate-400 group-hover:text-brand text-sm font-medium transition-colors">
              New collection
            </span>
          </button>
        </div>
      )}
    </>
  );
}

// ─── Individual collection card ───────────────────────────────────────────────

function CollectionCard({ collection: col }: { collection: CollectionData }) {
  const [pickerOpen, setPickerOpen]   = useState(false);
  const [isPending, startTransition]  = useTransition();

  // Determine which photos are available to choose from
  const photoOptions = col.cards
    .map(cc => cc.card.photos[0])
    .filter((p): p is string => !!p);

  // Active cover: explicit coverImage → last card's photo → null
  const coverUrl = col.coverImage ?? photoOptions[0] ?? null;

  function pickCover(url: string) {
    startTransition(async () => {
      await setCollectionCoverAction(col.id, url);
      setPickerOpen(false);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col">

      {/* ── Thumbnail ── */}
      {pickerOpen ? (
        /* Cover picker */
        <div className="bg-slate-50 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-navy text-xs font-semibold">Pick a cover photo</p>
            <button
              onClick={() => setPickerOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              aria-label="Close picker"
            >×</button>
          </div>
          {photoOptions.length === 0 ? (
            <p className="text-slate-400 text-xs py-3 text-center">No photos in this collection yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
              {photoOptions.map((url, i) => (
                <button
                  key={i}
                  onClick={() => pickCover(url)}
                  disabled={isPending}
                  className="relative overflow-hidden rounded hover:ring-2 hover:ring-brand transition-all disabled:opacity-60"
                  style={{ aspectRatio: "2.5/3.5" }}
                  aria-label={`Set photo ${i + 1} as cover`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {url === col.coverImage && (
                    <div className="absolute inset-0 ring-2 ring-brand bg-brand/10 flex items-center justify-center">
                      <CheckIcon className="w-5 h-5 text-brand" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Normal thumbnail */
        <div className="relative" style={{ aspectRatio: "3/4" }}>
          <Link href={`/dashboard/collections/${col.id}`} className="block w-full h-full">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt={col.name}
                className="w-full h-full object-contain bg-slate-100"
              />
            ) : (
              <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                <CollectionIcon className="w-10 h-10 text-slate-300" />
              </div>
            )}
          </Link>

          {/* Change cover button — appears on hover */}
          <button
            onClick={() => setPickerOpen(true)}
            className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Change cover photo"
            title="Change cover"
          >
            <CameraIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Info ── */}
      <Link href={`/dashboard/collections/${col.id}`} className="p-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-navy font-bold text-sm leading-snug group-hover:text-brand transition-colors">
            {col.name}
          </h3>
          {col.isPublic && (
            <span className="text-xs bg-brand-muted text-brand font-medium px-2 py-0.5 rounded-full shrink-0">
              Public
            </span>
          )}
        </div>
        {col.description && (
          <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{col.description}</p>
        )}
        <p className="text-slate-400 text-xs mt-1.5">
          {col._count.cards} {col._count.cards === 1 ? "card" : "cards"}
        </p>
      </Link>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CollectionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  );
}
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}
function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
