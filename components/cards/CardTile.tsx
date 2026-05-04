"use client";

import Link from "next/link";
import type { CardRow } from "./CollectionView";

const GRADE_COLORS: Record<string, string> = {
  PSA: "#185FA5",
  BGS: "#1a1a1a",
  CGC: "#d97706",
  SGC: "#059669",
};

export function CardTile({ card }: { card: CardRow }) {
  const hasPhoto = card.photos.length > 0;

  return (
    <Link
      href={`/dashboard/cards/${card.id}`}
      className="group block"
    >
      {/* Card image frame — true trading card aspect ratio 2.5 : 3.5 */}
      <div
        className="relative overflow-hidden bg-slate-100 shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-200"
        style={{ aspectRatio: "2.5 / 3.5" }}
      >
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.photos[0]}
            alt={card.player}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Placeholder with player initial */
          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center p-2">
            <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center mb-2">
              <span className="text-slate-500 text-sm font-bold">
                {card.player.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-slate-500 text-xs font-medium text-center leading-tight line-clamp-2">
              {card.player}
            </p>
          </div>
        )}

        {/* Grade badge — top right */}
        {card.grade && (
          <div
            className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-white font-bold shadow-sm"
            style={{
              background: GRADE_COLORS[card.gradeCompany ?? ""] ?? "#475569",
              fontSize: "9px",
            }}
          >
            {card.gradeCompany} {card.grade}
          </div>
        )}

        {/* Tags — top left, show first tag only */}
        {card.tags[0] && (
          <div className="absolute top-1.5 left-1.5 bg-black/50 text-white px-1.5 py-0.5 rounded-md"
            style={{ fontSize: "8px", fontWeight: 600 }}
          >
            {card.tags[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Card info below the tile */}
      <div className="mt-2 px-0.5">
        <p className="text-navy text-xs font-semibold leading-tight truncate group-hover:text-brand transition-colors">
          {card.player}
        </p>
        <p className="text-slate-400 text-xs leading-tight truncate">
          {card.year} {card.set}
        </p>
        <p className="text-navy text-xs font-bold mt-0.5">
          {card.estimatedValue
            ? `$${card.estimatedValue.toLocaleString()}`
            : <span className="text-slate-300">$—</span>
          }
        </p>
      </div>
    </Link>
  );
}
