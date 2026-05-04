"use client";

import { useState, useTransition } from "react";
import { deleteCardAction, removeFromCollectionAction } from "@/lib/actions/cards";

type Confirming = "remove" | "delete" | null;

interface Props {
  cardId: string;
  collectionId: string | null;
}

export function CardActions({ cardId, collectionId }: Props) {
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [isPending, startTransition] = useTransition();

  function cancel() { setConfirming(null); }

  function doRemove() {
    if (!collectionId) return;
    startTransition(async () => { await removeFromCollectionAction(cardId, collectionId); });
  }

  function doDelete() {
    startTransition(async () => { await deleteCardAction(cardId); });
  }

  // ── Confirming remove from collection ─────────────────────────────────────
  if (confirming === "remove") {
    return (
      <>
        <div className="col-span-full text-xs text-slate-500 text-center -mb-1">
          Remove from this collection only — card stays in your library.
        </div>
        <button onClick={cancel}
          className="flex-1 border border-slate-200 text-slate-500 text-xs font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <button disabled={isPending} onClick={doRemove}
          className="flex-1 bg-slate-700 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-60">
          {isPending ? "Removing…" : "Yes, remove"}
        </button>
      </>
    );
  }

  // ── Confirming permanent delete ───────────────────────────────────────────
  if (confirming === "delete") {
    return (
      <>
        <div className="col-span-full text-xs text-slate-500 text-center -mb-1">
          This permanently deletes the card and all its data.
        </div>
        <button onClick={cancel}
          className="flex-1 border border-slate-200 text-slate-500 text-xs font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <button disabled={isPending} onClick={doDelete}
          className="flex-1 bg-alert text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-red-800 transition-colors disabled:opacity-60">
          {isPending ? "Deleting…" : "Yes, delete forever"}
        </button>
      </>
    );
  }

  // ── Default state ─────────────────────────────────────────────────────────
  return (
    <>
      {collectionId && (
        <button onClick={() => setConfirming("remove")}
          className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
          Remove from collection
        </button>
      )}
      <button onClick={() => setConfirming("delete")}
        className="px-4 py-2.5 text-alert border border-alert/30 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors whitespace-nowrap">
        Delete card
      </button>
    </>
  );
}
