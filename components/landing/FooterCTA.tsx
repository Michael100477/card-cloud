import Link from "next/link";
import type { LinksMap } from "@/lib/links";
import { getLink } from "@/lib/links";

export function FooterCTA({ links = {} }: { links?: LinksMap }) {
  const signup = getLink(links, "footer_signup");
  const login  = getLink(links, "footer_login");

  // If both buttons are disabled, hide the whole section
  if (!signup && !login) return null;

  return (
    <section className="bg-navy py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-white text-3xl sm:text-4xl font-bold leading-tight mb-4">
          Start tracking your collection today.
        </h2>
        <p className="text-sky-highlight text-lg mb-8 leading-relaxed">
          Free up to 100 cards. No credit card required. Upgrade anytime.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {signup && (
            <Link href={signup.href} className="bg-amber text-amber-dark font-semibold px-8 py-3.5 rounded-xl text-base hover:brightness-105 transition-all">
              {signup.label}
            </Link>
          )}
          {login && (
            <Link href={login.href} className="text-white/80 hover:text-white font-medium px-8 py-3.5 rounded-xl text-base border border-white/20 hover:border-white/40 transition-all">
              {login.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export function PageFooter({ links = {} }: { links?: LinksMap }) {
  const privacy = getLink(links, "footer_privacy");
  const terms   = getLink(links, "footer_terms");
  const contact = getLink(links, "footer_contact");

  return (
    <footer className="bg-navy border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-sm">
            © 2026 The Card Cloud. All rights reserved.
          </p>
          <div className="flex gap-6">
            {privacy && <Link href={privacy.href} className="text-white/40 hover:text-white/70 text-sm transition-colors">{privacy.label}</Link>}
            {terms   && <Link href={terms.href}   className="text-white/40 hover:text-white/70 text-sm transition-colors">{terms.label}</Link>}
            {contact && <Link href={contact.href} className="text-white/40 hover:text-white/70 text-sm transition-colors">{contact.label}</Link>}
          </div>
        </div>
      </div>
    </footer>
  );
}
