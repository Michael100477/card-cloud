import Link from "next/link";
import { getLinksMap, seedLinks } from "@/lib/links";
import { CardCloudMark } from "@/components/brand/CardCloudLogo";

const PLATFORM_KEYS = [
  "footer_platform_track", "footer_platform_sell", "footer_platform_offer",
  "footer_platform_consign", "footer_platform_trade",
] as const;

const COMPANY_KEYS = [
  "footer_company_howto", "footer_company_about", "footer_company_pricing",
  "footer_company_support", "footer_company_contact",
] as const;

const LEGAL_LINKS = [
  { label: "Pricing",          href: "/pricing" },
  { label: "Privacy Policy",   href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "FAQ",              href: "/faq" },
];

const SOCIAL_KEYS = ["social_instagram", "social_facebook", "social_x", "social_youtube", "social_tiktok"] as const;

export async function SiteFooter() {
  await seedLinks();
  const links = await getLinksMap();

  const platformLinks = PLATFORM_KEYS.map(k => links[k]).filter(l => l?.enabled && l.href);
  const companyLinks  = COMPANY_KEYS.map(k => links[k]).filter(l => l?.enabled && l.href);
  const socialLinks   = SOCIAL_KEYS.map(key => links[key]).filter(l => l && l.enabled && l.href);

  return (
    <footer className="bg-navy border-t border-white/10">
      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

          {/* Brand column */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <CardCloudMark size={38} />
              <span className="text-sm leading-none">
                <span className="text-white/55 font-normal">The </span>
                <span className="text-white font-bold tracking-tight">Card </span>
                <span className="text-amber font-bold tracking-tight">Cloud</span>
              </span>
            </Link>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              The smartest home for your card collection. Track values, sell safely, consign with confidence, and trade with peace of mind.
            </p>

            {/* Social icons */}
            {socialLinks.length > 0 && (
              <div className="mt-6">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Follow Us</p>
                <div className="flex items-center gap-3">
                  {socialLinks.map(link => (
                    <a key={link.key} href={link.href} target="_blank" rel="noopener noreferrer"
                      aria-label={link.label}
                      className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all">
                      <SocialIcon name={link.key} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Platform column */}
          {platformLinks.length > 0 && (
            <div>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">Platform</p>
              <ul className="flex flex-col gap-2.5">
                {platformLinks.map(l => (
                  <li key={l.key}>
                    <Link href={l.href} className="text-white/60 text-sm hover:text-white transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Company column */}
          {companyLinks.length > 0 && (
            <div>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">Company</p>
              <ul className="flex flex-col gap-2.5">
                {companyLinks.map(l => (
                  <li key={l.key}>
                    <Link href={l.href} className="text-white/60 text-sm hover:text-white transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/30 text-xs">© 2026 The Card Cloud. All rights reserved.</p>
          <div className="flex items-center gap-5">
            {LEGAL_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="text-white/40 hover:text-white/70 text-xs transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function CardStackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 24" fill="none" aria-hidden="true">
      <rect x="0" y="8" width="21" height="14" rx="2.5" fill="currentColor" opacity="0.3" />
      <rect x="3" y="4" width="21" height="14" rx="2.5" fill="currentColor" opacity="0.6" />
      <rect x="6" y="0" width="21" height="14" rx="2.5" fill="currentColor" />
    </svg>
  );
}

function SocialIcon({ name }: { name: string }) {
  if (name === "social_instagram") return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
  if (name === "social_facebook") return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
  if (name === "social_x") return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
  if (name === "social_youtube") return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12z" />
    </svg>
  );
  if (name === "social_tiktok") return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  );
  return null;
}
