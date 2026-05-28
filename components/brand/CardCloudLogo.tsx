/**
 * The Card Cloud logo mark — three playing cards fanning out beneath a bold cloud.
 * Works on dark backgrounds (navy, black). The cloud is white; cards are amber/gold.
 */

interface LogoMarkProps {
  className?: string;
  /** Size in pixels — sets both width and height. Default: 40 */
  size?: number;
}

export function CardCloudMark({ className, size = 40 }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="The Card Cloud logo"
      className={className}
    >
      {/* ── Playing cards (rendered behind cloud) ─────────────────────────── */}

      {/* Left card — tilted left */}
      <g transform="rotate(-16 11 46)">
        <rect x="5" y="15" width="12" height="31" rx="2" fill="#D97706" opacity="0.85" />
        {/* Card header band */}
        <rect x="5" y="15" width="12" height="5" rx="2" fill="#B45309" opacity="0.9" />
        <rect x="5" y="18" width="12" height="2" fill="#B45309" opacity="0.9" />
        {/* Card lines (visible at bottom) */}
        <rect x="7" y="35" width="8" height="1.2" rx="0.6" fill="white" opacity="0.45" />
        <rect x="7" y="38" width="5" height="1.2" rx="0.6" fill="white" opacity="0.3" />
        <rect x="7" y="41" width="7" height="1.2" rx="0.6" fill="white" opacity="0.2" />
      </g>

      {/* Right card — tilted right */}
      <g transform="rotate(16 45 46)">
        <rect x="39" y="15" width="12" height="31" rx="2" fill="#D97706" opacity="0.85" />
        <rect x="39" y="15" width="12" height="5" rx="2" fill="#B45309" opacity="0.9" />
        <rect x="39" y="18" width="12" height="2" fill="#B45309" opacity="0.9" />
        <rect x="41" y="35" width="8" height="1.2" rx="0.6" fill="white" opacity="0.45" />
        <rect x="41" y="38" width="5" height="1.2" rx="0.6" fill="white" opacity="0.3" />
        <rect x="41" y="41" width="7" height="1.2" rx="0.6" fill="white" opacity="0.2" />
      </g>

      {/* Center card — straight up, slightly taller */}
      <rect x="22" y="11" width="12" height="36" rx="2" fill="#EF9F27" />
      {/* Header band */}
      <rect x="22" y="11" width="12" height="6" rx="2" fill="#D97706" />
      <rect x="22" y="15" width="12" height="2" fill="#D97706" />
      {/* Card number in art area */}
      <text x="28" y="32" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold"
        fontFamily="system-ui, sans-serif" opacity="0.7">24</text>
      {/* Stat lines */}
      <rect x="24" y="36" width="8" height="1.2" rx="0.6" fill="white" opacity="0.5" />
      <rect x="24" y="39" width="5" height="1.2" rx="0.6" fill="white" opacity="0.35" />
      <rect x="24" y="42" width="7" height="1.2" rx="0.6" fill="white" opacity="0.25" />

      {/* ── Cloud (white) — sits on top of the cards ──────────────────────── */}
      {/* The cloud covers the upper ~40% of each card */}

      {/* Cloud formed by overlapping circles */}
      <circle cx="7"  cy="28" r="7"  fill="white" />
      <circle cx="16" cy="21" r="11" fill="white" />
      <circle cx="28" cy="16" r="13" fill="white" />
      <circle cx="40" cy="21" r="11" fill="white" />
      <circle cx="49" cy="28" r="7"  fill="white" />

      {/* Fill the flat bottom of the cloud (prevents gaps between circles) */}
      <rect x="0" y="24" width="56" height="9" fill="white" />
    </svg>
  );
}

/** Full logo lockup: mark + wordmark */
export function CardCloudLogo({ size = 36 }: { size?: number }) {
  const textSize = Math.round(size * 0.36);
  return (
    <span className="flex items-center gap-2.5">
      <CardCloudMark size={size} />
      <span style={{ fontSize: textSize }} className="leading-none">
        <span className="text-white/55 font-normal">The </span>
        <span className="text-white font-bold tracking-tight">Card </span>
        <span className="text-amber font-bold tracking-tight">Cloud</span>
      </span>
    </span>
  );
}
