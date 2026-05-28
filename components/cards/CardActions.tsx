"use client";

import { useState, useEffect, useTransition } from "react";
import {
  deleteCardAction,
  removeFromCollectionAction,
  getCardCollectionCountAction,
  getAvailableCollectionsAction,
  addToCollectionAction,
} from "@/lib/actions/cards";

type Confirming = "remove" | "delete" | null;
interface Collection { id: string; name: string }

interface Props {
  cardId:       string;
  collectionId: string | null;
}

export function CardActions({ cardId, collectionId }: Props) {
  const [confirming,    setConfirming]    = useState<Confirming>(null);
  const [collectionCount, setCollectionCount] = useState<number | null>(null);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [available,     setAvailable]     = useState<Collection[] | null>(null);
  const [selectedColId, setSelectedColId] = useState("");
  const [loadingAvail,  setLoadingAvail]  = useState(false);
  const [addSuccess,    setAddSuccess]    = useState(false);
  const [isPending,     startTransition]  = useTransition();

  useEffect(() => {
    getCardCollectionCountAction(cardId).then(setCollectionCount);
  }, [cardId]);

  function cancel() { setConfirming(null); }

  function doRemove() {
    if (!collectionId) return;
    startTransition(async () => { await removeFromCollectionAction(cardId, collectionId); });
  }

  function doDelete() {
    startTransition(async () => { await deleteCardAction(cardId); });
  }

  async function openAddPicker() {
    setShowAddPicker(true);
    setAddSuccess(false);
    setSelectedColId("");
    if (available === null) {
      setLoadingAvail(true);
      const cols = await getAvailableCollectionsAction(cardId);
      setAvailable(cols);
      setLoadingAvail(false);
    }
  }

  async function doAdd() {
    if (!selectedColId) return;
    startTransition(async () => {
      await addToCollectionAction(cardId, selectedColId);
      const [cols, count] = await Promise.all([
        getAvailableCollectionsAction(cardId),
        getCardCollectionCountAction(cardId),
      ]);
      setAvailable(cols);
      setCollectionCount(count);
      setSelectedColId("");
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 2500);
    });
  }

  // ── Confirming remove ─────────────────────────────────────────────────────
  if (confirming === "remove") {
    return (
      <>
        <p className="col-span-full text-xs text-slate-500 text-center -mb-1">
          Removes the card from this collection only. It stays in your other collections.
        </p>
        <button onClick={cancel}
          className="flex-1 border border-slate-200 text-slate-500 text-xs font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <button disabled={isPending} onClick={doRemove}
          className="flex-1 bg-slate-700 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors">
          {isPending ? "Removing…" : "Yes, remove"}
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
          className="flex-1 bg-alert text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-red-800 disabled:opacity-60 transition-colors">
          {isPending ? "Deleting…" : "Yes, delete forever"}
        </button>
      </>
    );
  }

  // ── Default ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Add to another collection */}
      {!showAddPicker ? (
        <button onClick={openAddPicker}
          className="flex-1 border border-brand/30 text-brand text-sm font-medium py-2.5 rounded-xl hover:bg-brand/5 transition-colors">
          Add to another collection
        </button>
      ) : (
        <div className="col-span-full flex flex-col gap-2">
          {addSuccess && (
            <p className="text-green-600 text-xs text-center font-medium">✓ Added to collection!</p>
          )}
          {loadingAvail ? (
            <p className="text-slate-400 text-xs text-center py-1">Loading collections…</p>
          ) : available && available.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-1">
              This card is already in all your collections.
            </p>
          ) : (
            <div className="flex gap-2">
              <select value={selectedColId} onChange={e => setSelectedColId(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white">
                <option value="">Choose a collection…</option>
                {(available ?? []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button onClick={doAdd} disabled={!selectedColId || isPending}
                className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-colors shrink-0">
                {isPending ? "…" : "Add"}
              </button>
            </div>
          )}
          <button onClick={() => setShowAddPicker(false)}
            className="text-slate-400 text-xs hover:text-slate-600 text-center">
            Cancel
          </button>
        </div>
      )}

      {/* Remove from collection — only when card is in 2+ collections */}
      {collectionId && collectionCount !== null && collectionCount > 1 && (
        <button onClick={() => setConfirming("remove")}
          className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
          Remove from collection
        </button>
      )}

      {/* Delete card */}
      <button onClick={() => setConfirming("delete")}
        className="px-4 py-2.5 text-alert border border-alert/30 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors whitespace-nowrap">
        Delete card
      </button>
    </>
  );
}
