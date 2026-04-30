import Link from "next/link";

export function FooterCTA() {
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
          <Link
            href="/signup"
            className="bg-amber text-amber-dark font-semibold px-8 py-3.5 rounded-xl text-base hover:brightness-105 transition-all"
          >
            Sign up free
          </Link>
          <Link
            href="/login"
            className="text-white/80 hover:text-white font-medium px-8 py-3.5 rounded-xl text-base border border-white/20 hover:border-white/40 transition-all"
          >
            Log in
          </Link>
        </div>
      </div>
    </section>
  );
}

export function PageFooter() {
  return (
    <footer className="bg-navy border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-sm">
            © 2026 The Card Cloud. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-white/40 hover:text-white/70 text-sm transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-white/40 hover:text-white/70 text-sm transition-colors">
              Terms
            </Link>
            <Link href="/contact" className="text-white/40 hover:text-white/70 text-sm transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
