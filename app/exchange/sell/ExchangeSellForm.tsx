"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Card {
  id:           string;
  player:       string;
  year:         number | null;
  manufacturer: string | null;
  set:          string | null;
  grade:        string | null;
  gradeCompany: string | null;
  photos:       string[];
  sport:        string | null;
}

interface Props {
  card: Card;
}

export function ExchangeSellForm({ card }: Props) {
  const router = useRouter();
  const [price,       setPrice]       = useState("");
  const [description, setDescription] = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const graded     = !!card.grade;
  const gradeLabel = graded ? `${card.gradeCompany} ${card.grade}` : null;
  const subtitle   = [card.year, card.manufacturer, card.set, gradeLabel]
    .filter(Boolean)
    .join(" · ");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      setError("Please enter a valid price.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/exchange/listings", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          collectionCardId: card.id,
          price:            parseFloat(price),
          description:      description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSaving(false);
        return;
      }
      router.push("/dashboard/selling");
    } catch {
      setError("Network error — please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Back link */}
      <Link
        href={`/dashboard/cards/${card.id}`}
        className="flex items-center gap-1.5 text-slate-400 hover:text-navy text-sm transition-colors w-fit"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to card
      </Link>

      {/* Page heading */}
      <div>
        <h1 className="text-navy text-2xl font-bold">List for sale</h1>
        <p className="text-slate-400 text-sm mt-0.5">Set your price and list this card on The Exchange.</p>
      </div>

      {/* Card summary */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
        {card.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.photos[0]}
            alt={card.player}
            className="w-14 h-18 object-cover rounded-xl border border-slate-200 shrink-0"
            style={{ height: "4.5rem" }}
          />
        ) : (
          <div className="w-14 rounded-xl border border-slate-200 bg-slate-50 shrink-0" style={{ height: "4.5rem" }} />
        )}
        <div className="min-w-0">
          <p className="text-navy font-bold text-base truncate">{card.player}</p>
          {subtitle && (
            <p className="text-slate-400 text-sm truncate mt-0.5">{subtitle}</p>
          )}
          {card.sport && (
            <span className="inline-block mt-1.5 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              {card.sport}
            </span>
          )}
        </div>
      </div>

      {/* Listing form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Price */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <label htmlFor="price" className="block text-navy font-semibold text-sm mb-1">
            Asking price <span className="text-red-400">*</span>
          </label>
          <p className="text-slate-400 text-xs mb-3">
            Set the price buyers see. Our commission is deducted at sale.
          </p>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">$</span>
            <input
              id="price"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="49.99"
              className="w-full border border-slate-200 rounded-xl pl-7 pr-4 py-2.5 text-sm text-navy placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <label htmlFor="description" className="block text-navy font-semibold text-sm mb-1">
            Description <span className="text-slate-300 font-normal">(optional)</span>
          </label>
          <textarea
            id="description"
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the card's condition, any notable features..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-navy placeholder-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-base transition-colors"
        >
          {saving ? "Listing…" : "List for Sale"}
        </button>
      </form>
    </div>
  );
}
