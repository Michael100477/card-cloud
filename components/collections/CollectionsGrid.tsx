"use client";

import { useState } from "react";
import Link from "next/link";
import { CreateCollectionModal } from "./CreateCollectionModal";

interface CollectionData {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  _count: { cards: number };
  cards: Array<{
    card: { photos: string[]; player: string };
  }>;
}

export function CollectionsGrid({ collections }: { collections: CollectionData[] }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <CreateCollectionModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {collections.length === 0 ? (
        /* Empty state */
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Existing collection cards */}
          {collections.map((col) => (
            <Link
              key={col.id}
              href={`/dashboard/collections/${col.id}`}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              {/* Thumbnail strip */}
              <div className="h-24 bg-slate-100 flex">
                {col.cards.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <CollectionIcon className="w-8 h-8 text-slate-300" />
                  </div>
                ) : (
                  col.cards.slice(0, 3).map((cc, i) =>
                    cc.card.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={cc.card.photos[0]}
                        alt={cc.card.player}
                        className="flex-1 object-cover"
                      />
                    ) : (
                      <div key={i} className="flex-1 bg-slate-200 flex items-center justify-center">
                        <span className="text-slate-400 text-xs font-medium truncate px-1">
                          {cc.card.player.split(" ").pop()}
                        </span>
                      </div>
                    )
                  )
                )}
              </div>

              {/* Info */}
              <div className="p-4">
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
                  <p className="text-slate-400 text-xs mt-1 line-clamp-1">{col.description}</p>
                )}
                <p className="text-slate-400 text-xs mt-2">
                  {col._count.cards} {col._count.cards === 1 ? "card" : "cards"}
                </p>
              </div>
            </Link>
          ))}

          {/* + New collection tile */}
          <button
            onClick={() => setModalOpen(true)}
            className="bg-white rounded-2xl border-2 border-dashed border-slate-200 h-full min-h-[140px] flex flex-col items-center justify-center gap-2 hover:border-brand hover:bg-brand-muted/30 transition-all duration-200 group"
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
