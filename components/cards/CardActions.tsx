"use client";

import { useState, useEffect, useTransition } from "react";
import {
  deleteCardAction,
  removeFromCollectionAction,
  getCardCollectionCountAction,
} from "@/lib/actions/cards";

type Confirming = "remove" | "delete" | null;

interface Props {
  cardId: string;
  collectionId: string | null;
}

export function CardActions({ cardId, collectionId }: Props) {
  const [confirming, setConfirming]         = useState<Confirming>(null);
  const [collectionCount, setCollectionCount] = useState<number | null>(null);
  const [isPending, startTransition]        = useTransition();

  // Know how many collections this card belongs to so we can show
  // accurate confirmation text before the user commits.
  useEffect(() => {
    if (collectionId) {
      getCardCollectionCountAction(cardId).then(setCollectionCount);
    }
  }, [cardId, collectionId]);

  function cancel() { setConfirming(null); }

  function doRemove() {
    if (!collectionId) return;
    startTransition(async () => { await removeFromCollectionAction(cardId, collectionId); });
  }

  function doDelete() {
    startTransition(async () => { await deleteCardAction(cardId); });
  }

  // ── Confirming remove ─────────────────────────────────────────────────────
  if (confirming === "remove") {
    const isLastCollection = collectionCount === 1;
    return (
      <>
        <p className="col-span-full text-xs text-slate-500 text-center -mb-1">
          {isLastCollection
            ? "This is the card's only collection — removing it will delete the card from your library."
            : "Removes the card from this collection only. It will stay in your other collections."}
        </p>
        <button onClick={cancel}
          className="flex-1 border border-slate-200 text-slate-500 text-xs font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <button disabled={isPending} onClick={doRemove}
          className={`flex-1 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60 ${
            isLastCollection ? "bg-alert hover:bg-red-800" : "bg-slate-700 hover:bg-slate-800"
          }`}>
          {isPending
            ? "Removing…"
            : isLastCollection
              ? "Yes, delete"
              : "Yes, remove"}
        </button>
      </>
    );
  }

  // ── Confirming delete ─────────────────────────────────────────────────────
  if (confirming === "delete") {
    return (
      <>
        <p className="col-span-full text-xs text-slate-500 text-center -mb-1">
          This permanently deletes the card and all its data.
        </p>
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

  // ── Default ───────────────────────────────────────────────────────────────
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
