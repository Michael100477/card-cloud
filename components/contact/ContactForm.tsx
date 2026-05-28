"use client";

import { useState } from "react";
import Link from "next/link";

const inp = "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-brand/30 placeholder-slate-400 bg-white";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setErrorMsg("");
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) { setErrorMsg(d.error ?? "Something went wrong."); setState("error"); return; }
      setState("sent");
    } catch {
      setErrorMsg("Network error — please try again.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-navy font-bold text-2xl mb-2">Message sent!</h2>
        <p className="text-slate-500 text-sm mb-6">
          Thanks for reaching out. We'll get back to you within 1–2 business days. A confirmation has been sent to{" "}
          <span className="font-medium text-navy">{form.email}</span>.
        </p>
        <Link href="/" className="text-brand text-sm font-semibold hover:underline">← Back to home</Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-8">
      <h1 className="text-navy font-bold text-2xl mb-1">Contact us</h1>
      <p className="text-slate-400 text-sm mb-7">We'll get back to you within 1–2 business days.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide block mb-1.5">Name *</label>
            <input value={form.name} onChange={e => update("name", e.target.value)} placeholder="Your name" required className={inp} />
          </div>
          <div>
            <label className="text-navy text-xs font-semibold uppercase tracking-wide block mb-1.5">Email *</label>
            <input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="you@example.com" required className={inp} />
          </div>
        </div>
        <div>
          <label className="text-navy text-xs font-semibold uppercase tracking-wide block mb-1.5">Subject</label>
          <input value={form.subject} onChange={e => update("subject", e.target.value)} placeholder="What's this about?" className={inp} />
        </div>
        <div>
          <label className="text-navy text-xs font-semibold uppercase tracking-wide block mb-1.5">Message *</label>
          <textarea value={form.message} onChange={e => update("message", e.target.value)} placeholder="Tell us how we can help…" required rows={6} className={`${inp} resize-y`} />
        </div>
        {state === "error" && <p className="text-red-500 text-sm">{errorMsg}</p>}
        <button type="submit" disabled={state === "sending"}
          className="bg-brand text-white font-semibold py-3 rounded-xl text-sm hover:bg-blue-600 transition-colors disabled:opacity-50">
          {state === "sending" ? "Sending…" : "Send message"}
        </button>
      </form>
    </div>
  );
}
