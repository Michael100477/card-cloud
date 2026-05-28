import Link from "next/link";
import { SiteFooter } from "@/components/landing/SiteFooter";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-navy border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-white/60 text-sm hover:text-white transition-colors">← Home</Link>
          <Link href="/signup" className="bg-amber text-amber-dark text-sm font-semibold px-4 py-2 rounded-xl hover:brightness-105">Sign up free</Link>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-navy mb-3">About The Card Cloud</h1>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Built by a collector, for collectors.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-8 mb-6">
          <h2 className="text-navy font-bold text-xl mb-4">Our Story</h2>
          <div className="flex flex-col gap-4 text-slate-600 text-sm leading-relaxed">
            <p>The Card Cloud was founded by Michael Hayward with a simple goal: give serious card collectors a single place to track, sell, trade, and connect — without juggling five different apps and spreadsheets.</p>
            <p>Whether you're cataloging a vintage collection, consigning graded cards on eBay, or looking for a safe way to trade with someone across the country, The Card Cloud has you covered.</p>
            <p>We're in active development and growing fast. Have feedback? We'd love to hear from you.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: "📦", title: "Consignment", body: "We list on eBay for you and handle everything — photos, pricing, shipping." },
            { icon: "🤝", title: "The Exchange", body: "Peer-to-peer card sales with escrow so buyers and sellers are both protected." },
            { icon: "🔄", title: "Trading", body: "Facilitated trades with condition verification — safe from start to finish." },
          ].map(c => (
            <div key={c.title} className="bg-white rounded-2xl border border-slate-100 p-6">
              <div className="text-3xl mb-3">{c.icon}</div>
              <h3 className="text-navy font-bold text-sm mb-1">{c.title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link href="/contact" className="inline-flex items-center gap-1.5 bg-brand text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-blue-600 transition-colors">
            Get in touch →
          </Link>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
