import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <CardStackIcon className="w-7 h-7 text-amber" />
        <span className="text-sm">
          <span className="text-white/60 font-normal">The </span>
          <span className="text-brand font-bold text-base">Card Cloud</span>
        </span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        {children}
      </div>

      {/* Footer */}
      <p className="mt-6 text-white/30 text-xs text-center">
        © 2026 The Card Cloud
      </p>
    </div>
  );
}

function CardStackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 24" fill="none" aria-hidden="true">
      <rect x="0" y="8" width="21" height="14" rx="2.5" fill="currentColor" opacity="0.3" />
      <rect x="3" y="4" width="21" height="14" rx="2.5" fill="currentColor" opacity="0.6" />
      <rect x="6" y="0" width="21" height="14" rx="2.5" fill="currentColor" />
    </svg>
  );
}
