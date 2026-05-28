import { db } from "@/lib/db";
import { MessagesClient } from "./MessagesClient";

async function fetchAccounts() {
  const aiLabUrl = process.env.AI_LAB_URL ?? "http://localhost:3002";
  try {
    const r = await fetch(`${aiLabUrl}/api/email/accounts`, { cache: "no-store" });
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

export default async function MessagesPage() {
  const [threads, accounts] = await Promise.all([
    db.emailThread.findMany({
      orderBy: { updatedAt: "desc" },
      take:    50,
      include: { messages: { orderBy: { sentAt: "desc" }, take: 1 } },
    }),
    fetchAccounts(),
  ]);

  return (
    <MessagesClient
      initialAccounts={accounts}
      initialThreads={threads.map(t => ({
        id:               t.id,
        subject:          t.subject,
        fromEmail:        t.fromEmail,
        fromName:         t.fromName,
        type:             t.type,
        status:           t.status,
        category:         t.category,
        escalated:        t.escalated,
        escalationReason: t.escalationReason,
        updatedAt:        t.updatedAt.toISOString(),
        lastMessage:      t.messages[0]
          ? { role: t.messages[0].role, body: t.messages[0].body, sentAt: t.messages[0].sentAt.toISOString() }
          : null,
      }))}
    />
  );
}
