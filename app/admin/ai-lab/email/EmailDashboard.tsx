"use client";

import { useState, useEffect } from "react";

interface Thread {
  id: string; subject: string; fromEmail: string; fromName: string | null;
  type: string; status: string; category: string | null; escalated: boolean;
  escalationReason: string | null; updatedAt: string;
  lastMessage: { role: string; body: string; sentAt: string } | null;
}

interface EmailAccount {
  id: string; label: string; host: string; port: number;
  secure: boolean; user: string; pass: string; mailbox: string; active: boolean;
  pollIntervalSeconds?: number;
}

const STATUS_COLOR: Record<string, string> = {
  open:      "bg-blue-900/40 text-blue-400 border-blue-800",
  escalated: "bg-red-900/40 text-red-400 border-red-800",
  resolved:  "bg-green-900/40 text-green-400 border-green-800",
  draft:     "bg-amber-900/40 text-amber-400 border-amber-800",
};

const BLANK_ACCOUNT = { label: "", host: "", port: "993", secure: true, user: "", pass: "", mailbox: "INBOX" };

// Accounts API is proxied through to the AI Lab app so both apps share
// the same email-accounts.json file.
const ACCOUNTS_API = "/api/ai-lab/email/accounts";

export function EmailDashboard({ threads, initialAccounts }: { threads: Thread[]; initialAccounts: EmailAccount[] }) {
  const [tab,          setTab]          = useState<"inbox" | "sent" | "compose" | "accounts">("inbox");
  const [selected,     setSelected]     = useState<Thread | null>(null);
  const [selectedSent, setSelectedSent] = useState<Thread | null>(null);

  // Compose state
  const [toEmail,   setToEmail]   = useState("");
  const [company,   setCompany]   = useState("");
  const [purpose,   setPurpose]   = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [drafted,   setDrafted]   = useState<{ subject: string; body: string; threadId: string } | null>(null);
  const [drafting,  setDrafting]  = useState(false);
  const [sending,   setSending]   = useState(false);
  const [draftMsg,  setDraftMsg]  = useState("");

  // Accounts state
  const [accounts,       setAccounts]       = useState<EmailAccount[]>(initialAccounts);
  const [addForm,        setAddForm]        = useState(BLANK_ACCOUNT);
  const [addMsg,         setAddMsg]         = useState("");
  const [addSaving,      setAddSaving]      = useState(false);
  const [showAddForm,    setShowAddForm]    = useState(false);
  const [intervalDraft,  setIntervalDraft]  = useState<Record<string, string>>({});
  const [intervalSaving, setIntervalSaving] = useState<string | null>(null);

  const escalated = threads.filter(t => t.escalated);
  const inbox     = threads.filter(t => t.type === "inbound");
  const sent      = threads.filter(t =>
    t.type === "outbound" || t.lastMessage?.role === "agent" || t.lastMessage?.role === "human",
  );

  async function draftEmail() {
    setDrafting(true); setDraftMsg(""); setDrafted(null);
    try {
      const r = await fetch("/api/email/draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail, company, purpose, keyPoints }),
      });
      const d = await r.json();
      if (d.error) setDraftMsg(`Error: ${d.error}`);
      else setDrafted(d);
    } catch (e) { setDraftMsg(`Error: ${e}`); }
    setDrafting(false);
  }

  async function sendDraft() {
    if (!drafted) return;
    setSending(true);
    try {
      await fetch("/api/email/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: drafted.threadId, toEmail }),
      });
      setDraftMsg("✓ Email sent!");
      setDrafted(null); setToEmail(""); setCompany(""); setPurpose(""); setKeyPoints("");
    } catch (e) { setDraftMsg(`Error: ${e}`); }
    setSending(false);
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setAddSaving(true); setAddMsg("");
    try {
      const r = await fetch(ACCOUNTS_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addForm, port: parseInt(addForm.port) }),
      });
      const saved = await r.json();
      setAccounts(prev => [...prev, saved]);
      setAddForm(BLANK_ACCOUNT);
      setShowAddForm(false);
      setAddMsg("✓ Account added");
    } catch (e) { setAddMsg(`Error: ${e}`); }
    setAddSaving(false);
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(ACCOUNTS_API, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, active } : a));
  }

  async function saveInterval(id: string) {
    const raw = intervalDraft[id];
    const seconds = parseInt(raw ?? "");
    if (isNaN(seconds) || seconds < 15) return;
    setIntervalSaving(id);
    await fetch(ACCOUNTS_API, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pollIntervalSeconds: seconds }),
    });
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, pollIntervalSeconds: seconds } : a));
    setIntervalDraft(d => { const n = { ...d }; delete n[id]; return n; });
    setIntervalSaving(null);
  }

  async function deleteAccount(id: string) {
    await fetch(ACCOUNTS_API, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setAccounts(prev => prev.filter(a => a.id !== id));
  }

  const inp = "w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/40 placeholder-slate-500";

  return (
    <div className="flex gap-6">
      {/* Left panel */}
      <div className="w-80 shrink-0 flex flex-col gap-3">
        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg">
          {(["inbox", "sent", "compose", "accounts"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${tab === t ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>
              {t === "inbox"    ? `Inbox (${inbox.length})`
               : t === "sent"    ? `Sent (${sent.length})`
               : t === "accounts" ? `Accounts (${accounts.length})`
               : "Compose"}
            </button>
          ))}
        </div>

        {tab === "inbox" && (
          <>
            {escalated.length > 0 && (
              <div className="mb-1">
                <p className="text-red-400 text-xs font-semibold uppercase tracking-wide mb-2">Needs attention</p>
                {escalated.map(t => <ThreadRow key={t.id} t={t} selected={selected?.id === t.id} onClick={() => setSelected(t)} />)}
              </div>
            )}
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">All threads</p>
              {threads.length === 0
                ? <p className="text-slate-600 text-sm">No email threads yet.</p>
                : threads.map(t => <ThreadRow key={t.id} t={t} selected={selected?.id === t.id} onClick={() => setSelected(t)} />)
              }
            </div>
          </>
        )}

        {tab === "sent" && (
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2 px-1">Sent replies &amp; outbound</p>
            {sent.length === 0
              ? <p className="text-slate-600 text-sm px-1">No sent messages yet.</p>
              : sent.map(t => (
                  <SentRow key={t.id} t={t} selected={selectedSent?.id === t.id}
                    onClick={() => setSelectedSent(t)} />
                ))
            }
          </div>
        )}

        {tab === "compose" && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-3">
            <p className="text-white text-sm font-semibold">Outbound email</p>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">To</label>
              <input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="contact@example.com" className={inp} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Company</label>
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="TCDB" className={inp} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Purpose</label>
              <textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={2} placeholder="Request data partnership…" className={inp + " resize-none"} />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Key points (optional)</label>
              <textarea value={keyPoints} onChange={e => setKeyPoints(e.target.value)} rows={2} placeholder="- We have X users…" className={inp + " resize-none"} />
            </div>
            <button onClick={draftEmail} disabled={!toEmail || !purpose || drafting}
              className="bg-brand text-white text-sm font-semibold py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50">
              {drafting ? "Drafting…" : "Draft with AI"}
            </button>
          </div>
        )}

        {tab === "accounts" && (
          <div className="flex flex-col gap-2">
            {accounts.length === 0 && <p className="text-slate-600 text-sm px-1">No accounts configured yet.</p>}
            {accounts.map(a => {
              const currentInterval = a.pollIntervalSeconds ?? 60;
              const draftVal = intervalDraft[a.id];
              const isDirty = draftVal !== undefined && draftVal !== String(currentInterval);
              return (
                <div key={a.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{a.label}</p>
                      <p className="text-slate-400 text-xs truncate">{a.user}</p>
                      <p className="text-slate-600 text-xs">{a.host}:{a.port}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={a.active} onChange={e => toggleActive(a.id, e.target.checked)} className="rounded" />
                        <span className="text-slate-400 text-xs">{a.active ? "Active" : "Paused"}</span>
                      </label>
                      <button onClick={() => deleteAccount(a.id)} className="text-red-500/60 hover:text-red-400 text-xs transition-colors">Remove</button>
                    </div>
                  </div>
                  {/* Poll interval row */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-700/60">
                    <span className="text-slate-500 text-xs">Check every</span>
                    <input
                      type="number" min={15}
                      value={draftVal ?? String(currentInterval)}
                      onChange={e => setIntervalDraft(d => ({ ...d, [a.id]: e.target.value }))}
                      className="w-16 bg-slate-700 border border-slate-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand/40"
                    />
                    <span className="text-slate-500 text-xs">seconds</span>
                    {isDirty && (
                      <button onClick={() => saveInterval(a.id)} disabled={intervalSaving === a.id}
                        className="text-xs text-brand hover:underline disabled:opacity-50 ml-1">
                        {intervalSaving === a.id ? "Saving…" : "Save"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <button onClick={() => setShowAddForm(v => !v)}
              className="mt-1 text-xs text-slate-500 hover:text-slate-300 text-left transition-colors px-1">
              {showAddForm ? "− Cancel" : "+ Add email account"}
            </button>
            {addMsg && <p className="text-green-400 text-xs px-1">{addMsg}</p>}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700">
        {tab === "compose" && drafted ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Review draft</h2>
              <div className="flex gap-2">
                <button onClick={() => setDrafted(null)} className="text-slate-400 text-sm hover:text-white">Edit</button>
                <button onClick={sendDraft} disabled={sending}
                  className="bg-amber text-amber-dark font-semibold text-sm px-4 py-1.5 rounded-lg hover:brightness-105 disabled:opacity-50">
                  {sending ? "Sending…" : "Send →"}
                </button>
              </div>
            </div>
            <div className="mb-3">
              <p className="text-slate-400 text-xs mb-1">Subject</p>
              <p className="text-white font-medium">{drafted.subject}</p>
            </div>
            <div className="mb-3">
              <p className="text-slate-400 text-xs mb-1">To</p>
              <p className="text-white">{toEmail}</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 mt-4">
              <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{drafted.body}</pre>
            </div>
            {draftMsg && <p className="text-green-400 text-sm mt-3">{draftMsg}</p>}
          </div>
        ) : tab === "compose" ? (
          <div className="p-8 text-center text-slate-500 text-sm">Fill in the form and click Draft to preview the email.</div>
        ) : tab === "accounts" && showAddForm ? (
          <AddAccountForm form={addForm} setForm={setAddForm} onSubmit={saveAccount} saving={addSaving} inp={inp} />
        ) : tab === "accounts" ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            {accounts.length === 0
              ? "Add an IMAP account to start polling your inbox."
              : `${accounts.filter(a => a.active).length} of ${accounts.length} account(s) active. Poll interval is configured per account below.`}
          </div>
        ) : tab === "sent" && selectedSent ? (
          <SentDetail thread={selectedSent} />
        ) : tab === "sent" ? (
          <div className="p-8 text-center text-slate-500 text-sm">Select a sent thread to view the conversation.</div>
        ) : selected ? (
          <ThreadDetail thread={selected} />
        ) : (
          <div className="p-8 text-center text-slate-500 text-sm">Select a thread to view the conversation.</div>
        )}
      </div>
    </div>
  );
}

function AddAccountForm({ form, setForm, onSubmit, saving, inp }: {
  form: typeof BLANK_ACCOUNT;
  setForm: React.Dispatch<React.SetStateAction<typeof BLANK_ACCOUNT>>;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  inp: string;
}) {
  const f = <K extends keyof typeof BLANK_ACCOUNT>(k: K) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: k === "secure" ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <form onSubmit={onSubmit} className="p-6 flex flex-col gap-4">
      <h2 className="text-white font-semibold">Add email account</h2>
      <p className="text-slate-400 text-xs -mt-2">
        Gmail: use an App Password (Google Account → Security → App passwords).
        Outlook: use <code className="text-slate-300">outlook.office365.com</code> port 993.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-slate-400 text-xs mb-1 block">Label</label>
          <input value={form.label} onChange={f("label")} placeholder="Card Cloud Support" className={inp} />
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1 block">IMAP host</label>
          <input value={form.host} onChange={f("host")} placeholder="imap.gmail.com" required className={inp} />
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Port</label>
          <input value={form.port} onChange={f("port")} type="number" className={inp} />
        </div>
        <div className="col-span-2">
          <label className="text-slate-400 text-xs mb-1 block">Email address</label>
          <input value={form.user} onChange={f("user")} placeholder="support@cardcloud.com" type="email" required className={inp} />
        </div>
        <div className="col-span-2">
          <label className="text-slate-400 text-xs mb-1 block">Password / App password</label>
          <input value={form.pass} onChange={f("pass")} type="password" required className={inp} placeholder="xxxx xxxx xxxx xxxx" />
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1 block">Mailbox</label>
          <input value={form.mailbox} onChange={f("mailbox")} placeholder="INBOX" className={inp} />
        </div>
        <div className="flex items-end pb-2.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.secure} onChange={f("secure")} className="rounded" />
            <span className="text-slate-300 text-sm">SSL/TLS</span>
          </label>
        </div>
      </div>
      <button type="submit" disabled={saving || !form.host || !form.user || !form.pass}
        className="bg-brand text-white text-sm font-semibold py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50">
        {saving ? "Saving…" : "Save account"}
      </button>
    </form>
  );
}

function SentRow({ t, selected, onClick }: { t: Thread; selected: boolean; onClick: () => void }) {
  const lastSentMsg = t.lastMessage?.role === "agent" || t.lastMessage?.role === "human" ? t.lastMessage : null;
  return (
    <button onClick={onClick} className={`w-full text-left p-3 rounded-lg border transition-colors mb-1 ${selected ? "bg-slate-700 border-slate-600" : "border-transparent hover:bg-slate-800"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-white text-sm font-medium truncate">{t.subject}</p>
        <span className="text-[10px] bg-slate-700 text-slate-400 border border-slate-600 px-1.5 py-0.5 rounded shrink-0">
          {t.type === "outbound" ? "Outbound" : "Reply"}
        </span>
      </div>
      <p className="text-slate-400 text-xs truncate mt-0.5">To: {t.fromName ?? t.fromEmail}</p>
      {lastSentMsg && <p className="text-slate-500 text-xs truncate mt-1">{lastSentMsg.body.slice(0, 60)}…</p>}
      {t.lastMessage && (
        <p className="text-slate-600 text-xs mt-1">
          {new Date(t.lastMessage.sentAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
      )}
    </button>
  );
}

interface FullMessage { id: string; role: string; body: string; sentAt: string; }

function SentDetail({ thread: t }: { thread: Thread }) {
  const [messages, setMessages] = useState<FullMessage[] | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null); setMessages(null);
    fetch(`/api/admin/email/threads/${t.id}`)
      .then(r => r.json())
      .then(d => { setMessages(d.messages ?? []); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [t.id]);

  return (
    <div className="p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-slate-700">
        <div>
          <h2 className="text-white font-semibold">{t.subject}</h2>
          <p className="text-slate-400 text-sm mt-0.5">{t.fromName ?? ""} &lt;{t.fromEmail}&gt;</p>
          {t.category && (
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded mt-1 inline-block capitalize">{t.category}</span>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[t.status] ?? ""}`}>{t.status}</span>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-3">
        {loading && <p className="text-slate-500 text-sm">Loading conversation…</p>}
        {error   && <p className="text-red-400 text-sm">{error}</p>}
        {messages && messages.map(m => (
          <div key={m.id} className={`rounded-xl p-4 text-sm ${m.role === "user" ? "bg-slate-900" : "bg-slate-700"}`}>
            <p className="text-slate-400 text-xs mb-2 capitalize">
              {m.role === "agent" ? "Agent reply" : m.role === "human" ? "Admin reply" : "Customer"} ·{" "}
              {new Date(m.sentAt).toLocaleString()}
            </p>
            <pre className="text-slate-200 whitespace-pre-wrap leading-relaxed">{m.body}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThreadRow({ t, selected, onClick }: { t: Thread; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full text-left p-3 rounded-lg border transition-colors mb-1 ${selected ? "bg-slate-700 border-slate-600" : "border-transparent hover:bg-slate-800"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-white text-sm font-medium truncate">{t.subject}</p>
        <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${STATUS_COLOR[t.status] ?? "bg-slate-700 text-slate-400"}`}>{t.status}</span>
      </div>
      <p className="text-slate-400 text-xs truncate mt-0.5">{t.fromName ?? t.fromEmail}</p>
      {t.lastMessage && <p className="text-slate-500 text-xs truncate mt-1">{t.lastMessage.body.slice(0, 60)}…</p>}
    </button>
  );
}

function ThreadDetail({ thread: t }: { thread: Thread }) {
  return (
    <div className="p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-slate-700">
        <div>
          <h2 className="text-white font-semibold">{t.subject}</h2>
          <p className="text-slate-400 text-sm mt-0.5">{t.fromName ?? ""} &lt;{t.fromEmail}&gt;</p>
          {t.category && (
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded mt-1 inline-block capitalize">{t.category}</span>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[t.status] ?? ""}`}>{t.status}</span>
      </div>
      {t.escalated && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-3 mb-4 text-sm">
          <p className="text-red-400 font-semibold mb-1">Escalated — needs your attention</p>
          <p className="text-red-300/70">{t.escalationReason}</p>
        </div>
      )}
      {t.lastMessage && (
        <div className="flex-1 overflow-y-auto">
          <div className={`rounded-xl p-4 text-sm ${t.lastMessage.role === "user" ? "bg-slate-900" : "bg-slate-700"}`}>
            <p className="text-slate-400 text-xs mb-2 capitalize">
              {t.lastMessage.role} · {new Date(t.lastMessage.sentAt).toLocaleString()}
            </p>
            <pre className="text-slate-200 whitespace-pre-wrap leading-relaxed">{t.lastMessage.body}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
