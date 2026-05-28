"use client";

import { useState } from "react";

interface ShareButtonsProps {
  title: string;
  description?: string;
  isPublic?: boolean;
}

export function ShareButtons({ title, description, isPublic }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  function getUrl() {
    return typeof window !== "undefined" ? window.location.href : "";
  }

  function copyLink() {
    navigator.clipboard.writeText(getUrl()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareToFacebook() {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getUrl())}`,
      "_blank", "width=600,height=400"
    );
  }

  function shareToX() {
    const text = description ? `${title} — ${description}` : title;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getUrl())}`,
      "_blank", "width=600,height=400"
    );
  }

  function shareToReddit() {
    window.open(
      `https://reddit.com/submit?url=${encodeURIComponent(getUrl())}&title=${encodeURIComponent(title)}`,
      "_blank", "width=900,height=600"
    );
  }

  async function nativeShare() {
    if (navigator.share) {
      await navigator.share({ title, text: description, url: getUrl() });
    } else {
      copyLink();
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Copy link */}
      <button
        onClick={copyLink}
        title="Copy link"
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-navy border border-slate-200 px-2.5 py-1.5 rounded-lg hover:border-slate-300 transition-colors"
      >
        {copied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <LinkIcon className="w-3.5 h-3.5" />}
        {copied ? "Copied!" : "Copy link"}
      </button>

      {/* Facebook */}
      <button
        onClick={shareToFacebook}
        title="Share on Facebook"
        className="p-1.5 text-slate-400 hover:text-[#1877F2] border border-slate-200 rounded-lg hover:border-[#1877F2]/30 transition-colors"
      >
        <FacebookIcon className="w-4 h-4" />
      </button>

      {/* X / Twitter */}
      <button
        onClick={shareToX}
        title="Share on X"
        className="p-1.5 text-slate-400 hover:text-black border border-slate-200 rounded-lg hover:border-slate-400 transition-colors"
      >
        <XIcon className="w-4 h-4" />
      </button>

      {/* Reddit */}
      <button
        onClick={shareToReddit}
        title="Share on Reddit"
        className="p-1.5 text-slate-400 hover:text-[#FF4500] border border-slate-200 rounded-lg hover:border-[#FF4500]/30 transition-colors"
      >
        <RedditIcon className="w-4 h-4" />
      </button>

      {/* More / native share (handles Instagram, WhatsApp, etc. on mobile) */}
      <button
        onClick={nativeShare}
        title="More share options"
        className="p-1.5 text-slate-400 hover:text-navy border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
      >
        <ShareIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
}
function CheckIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function ShareIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}
function FacebookIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
}
function XIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
}
function RedditIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>;
}
