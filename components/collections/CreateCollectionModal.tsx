"use client";

import { useState, useTransition } from "react";
import { createCollectionAction } from "@/lib/actions/collections";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateCollectionModal({ open, onClose }: Props) {
  const [isPublic, setIsPublic]     = useState(false);
  const [error, setError]           = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("isPublic", String(isPublic));
    startTransition(async () => {
      try {
        const result = await createCollectionAction(fd);
        if (result?.error) setError(result.error);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (!msg.includes("NEXT_REDIRECT")) setError("Something went wrong.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-navy text-xl font-bold mb-1">New collection</h2>
        <p className="text-slate-500 text-sm mb-5">
          Give your collection a name. You can add cards right after.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-100 text-alert text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="col-name" className="block text-sm font-medium text-navy mb-1.5">
              Name <span className="text-alert">*</span>
            </label>
            <input
              id="col-name" name="name" type="text" required maxLength={80}
              autoFocus
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
              placeholder="e.g. Rookies & Stars, Vintage Baseball"
            />
          </div>

          <div>
            <label htmlFor="col-desc" className="block text-sm font-medium text-navy mb-1.5">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="col-desc" name="description" rows={2}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition resize-none"
              placeholder="What's in this collection?"
            />
          </div>

          {/* Public toggle */}
          <button
            type="button"
            onClick={() => setIsPublic(!isPublic)}
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-left"
          >
            <div>
              <p className="text-navy text-sm font-medium">
                {isPublic ? "Public collection" : "Private collection"}
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                {isPublic
                  ? "Anyone can browse and follow this collection"
                  : "Only you can see this collection"}
              </p>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ml-4 ${isPublic ? "bg-brand" : "bg-slate-200"}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPublic ? "translate-x-5" : "translate-x-1"}`} />
            </div>
          </button>

          <div className="flex gap-3 mt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={isPending}
              className="flex-1 bg-amber text-amber-dark font-semibold py-2.5 rounded-xl text-sm hover:brightness-105 transition-all disabled:opacity-60"
            >
              {isPending ? "Creating…" : "Create collection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
