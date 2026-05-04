"use client";

import { useState, useTransition } from "react";
import { deleteCardAction } from "@/lib/actions/cards";

interface Props {
  cardId: string;
  collectionId: string | null;
}

export function CardActions({ cardId }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (confirming) {
    return (
      <div className="flex gap-2 flex-1">
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 border border-slate-200 text-slate-500 text-xs font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          disabled={isPending}
          onClick={() => startTransition(async () => { await deleteCardAction(cardId); })}
          className="flex-1 bg-alert text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-red-800 transition-colors disabled:opacity-60"
        >
          {isPending ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-4 py-2.5 text-alert border border-alert/30 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors"
    >
      Delete
    </button>
  );
}
