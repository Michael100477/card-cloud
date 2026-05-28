import Link from "next/link";
import { ContactForm } from "@/components/contact/ContactForm";
import { SiteFooter } from "@/components/landing/SiteFooter";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Nav */}
      <div className="bg-navy border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-white/60 text-sm hover:text-white transition-colors">← Back to home</Link>
          <Link href="/signup" className="bg-amber text-amber-dark text-sm font-semibold px-4 py-2 rounded-xl hover:brightness-105 transition-all">
            Sign up free
          </Link>
        </div>
      </div>

      <div className="flex-1 max-w-xl mx-auto w-full px-6 py-16">
        <ContactForm />
      </div>

      <SiteFooter />
    </div>
  );
}
