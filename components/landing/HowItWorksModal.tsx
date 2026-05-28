"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  buttonLabel: string;
  buttonClassName: string;
  title: string;
  body: string;
  videoUrl: string;
  ctaLabel: string;
}

export function HowItWorksModal({ buttonLabel, buttonClassName, title, body, videoUrl, ctaLabel }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className={buttonClassName}>
        {buttonLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4">
              <div>
                <h2 className="text-navy font-bold text-xl leading-tight">{title}</h2>
                {body && <p className="text-slate-400 text-sm mt-1.5">{body}</p>}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-navy text-3xl leading-none ml-4 shrink-0 transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Video */}
            <div className="mx-6 rounded-xl overflow-hidden bg-slate-100" style={{ aspectRatio: "16/9" }}>
              {videoUrl ? (
                <iframe
                  src={videoUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  title={title}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-300">
                  <PlayIcon className="w-14 h-14" />
                  <p className="text-sm font-medium text-slate-400">Video coming soon</p>
                  <p className="text-xs text-slate-400">Add a YouTube or Vimeo embed URL in Settings → Content</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-5 flex items-center justify-between">
              <Link
                href="/how-it-works"
                onClick={() => setOpen(false)}
                className="text-brand font-semibold text-sm hover:underline flex items-center gap-1"
              >
                {ctaLabel} →
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 text-sm hover:text-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.15" />
      <path d="M10 8.5l6 3.5-6 3.5V8.5z" />
    </svg>
  );
}
