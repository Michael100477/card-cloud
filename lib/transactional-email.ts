import { db } from "./db";

async function getSmtpConfig() {
  const keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_secure", "smtp_from"];
  const rows = await db.siteCredential.findMany({ where: { service: { in: keys } }, select: { service: true, value: true } });
  const m = Object.fromEntries(rows.map(r => [r.service, r.value]));
  if (!m.smtp_host || !m.smtp_user || !m.smtp_pass) return null;
  return {
    host:   m.smtp_host,
    port:   parseInt(m.smtp_port  || "587"),
    secure: m.smtp_secure === "true",
    user:   m.smtp_user,
    pass:   m.smtp_pass,
    from:   m.smtp_from || `The Card Cloud <${m.smtp_user}>`,
  };
}

export async function sendTransactionalEmail({
  to, subject, html, text,
}: { to: string; subject: string; html: string; text?: string }): Promise<void> {
  // Try SMTP first (credentials stored in admin → API Keys)
  try {
    const smtp = await getSmtpConfig();
    if (smtp) {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host:   smtp.host,
        port:   smtp.port,
        secure: smtp.secure,
        auth:   { user: smtp.user, pass: smtp.pass },
      });
      const info = await transporter.sendMail({ from: smtp.from, to, subject, html, ...(text ? { text } : {}) });
      console.log(`[email] SMTP sent to ${to}: ${subject} | messageId=${info.messageId} response="${info.response}" accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(info.rejected)}`);
      return;
    }
  } catch (e) {
    console.error("[email] SMTP send failed:", e);
    return;
  }

  // Fallback: Resend (if API key is set)
  const resendKey = process.env.RESEND_API_KEY || await db.siteCredential
    .findUnique({ where: { service: "resend_api_key" }, select: { value: true } })
    .then(r => r?.value || null).catch(() => null);

  if (!resendKey) {
    console.log(`[email] No SMTP or Resend credentials configured — skipping email to ${to}: ${subject}`);
    return;
  }

  try {
    const from = process.env.RESEND_FROM ?? "The Card Cloud <onboarding@resend.dev>";
    const r = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ from, to, subject, html }),
    });
    if (!r.ok) console.error("[email] Resend error:", await r.text());
    else console.log(`[email] Resend sent to ${to}: ${subject}`);
  } catch (e) {
    console.error("[email] Resend send failed:", e);
  }
}


// ── Email templates ────────────────────────────────────────────────────────────

export function consignmentReceivedHtml(opts: {
  userName: string;
  orderRef: string;
  receiptCode: string;
  itemCount: number;
  trackUrl: string;
}): string {
  return `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
    <div style="background:#042C53;padding:20px 24px">
      <p style="color:#fff;font-weight:bold;margin:0;font-size:18px">☁ The Card Cloud</p>
    </div>
    <div style="padding:24px;background:#fff">
      <h2 style="color:#042C53;margin:0 0 16px">We received your consignment, ${opts.userName}!</h2>
      <p style="color:#334155;line-height:1.6">Your package has been checked in. Here are your details:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr><td style="padding:8px 0;color:#64748b">Reference</td><td style="padding:8px 0;color:#042C53;font-weight:600">${opts.orderRef}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Receipt code</td><td style="padding:8px 0;color:#042C53;font-weight:600">${opts.receiptCode}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Cards received</td><td style="padding:8px 0;color:#042C53;font-weight:600">${opts.itemCount}</td></tr>
      </table>
      <p style="margin:24px 0 8px">
        <a href="${opts.trackUrl}" style="background:#EF9F27;color:#412402;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Track your consignment →</a>
      </p>
    </div>
    <div style="background:#042C53;padding:12px 24px">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© 2026 The Card Cloud · thecardcloud.com</p>
    </div>
  </div>`;
}

export function listingsReadyHtml(opts: {
  userName: string;
  orderRef: string;
  trackUrl: string;
  listings: { player: string; title: string; url: string | null; startPrice: number; buyItNowPrice: number | null }[];
}): string {
  const rows = opts.listings.map(l => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e2e8f0">
        <div style="color:#042C53;font-weight:600;font-size:14px">${l.player}</div>
        <div style="color:#64748b;font-size:12px;margin-top:2px">${l.title}</div>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;vertical-align:top">
        <div style="color:#042C53;font-weight:600;font-size:13px">$${l.startPrice.toFixed(2)}${l.buyItNowPrice ? ` &middot; BIN $${l.buyItNowPrice.toFixed(2)}` : ""}</div>
        ${l.url ? `<a href="${l.url}" style="color:#EF9F27;font-size:12px;text-decoration:none">View on eBay →</a>` : ""}
      </td>
    </tr>`).join("");

  return `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
    <div style="background:#042C53;padding:20px 24px">
      <p style="color:#fff;font-weight:bold;margin:0;font-size:18px">☁ The Card Cloud</p>
    </div>
    <div style="padding:24px;background:#fff">
      <h2 style="color:#042C53;margin:0 0 16px">Your cards are live on eBay, ${opts.userName}!</h2>
      <p style="color:#334155;line-height:1.6">All ${opts.listings.length} card${opts.listings.length === 1 ? "" : "s"} from order <strong>${opts.orderRef}</strong> are now listed.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}</table>
      <p style="margin:24px 0 8px">
        <a href="${opts.trackUrl}" style="background:#EF9F27;color:#412402;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Track your consignment →</a>
      </p>
    </div>
    <div style="background:#042C53;padding:12px 24px">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© 2026 The Card Cloud · thecardcloud.com</p>
    </div>
  </div>`;
}

// ── Trade emails ──────────────────────────────────────────────────────────────

function tradeShell(bodyHtml: string, footerLine: string): string {
  return `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
    <div style="background:#042C53;padding:20px 24px">
      <p style="color:#fff;font-weight:bold;margin:0;font-size:18px">☁ The Card Cloud</p>
    </div>
    <div style="padding:24px;background:#fff">
      ${bodyHtml}
    </div>
    <div style="background:#042C53;padding:12px 24px">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">${footerLine}</p>
    </div>
  </div>`;
}

function cardList(cards: { player: string; year?: number | null; set?: string | null }[]): string {
  if (cards.length === 0) return `<p style="color:#94a3b8;font-style:italic">(no cards)</p>`;
  return `<ul style="padding-left:20px;color:#334155;line-height:1.7;margin:8px 0">${
    cards.map(c => `<li><strong>${c.player}</strong>${c.year ? ` &middot; ${c.year}` : ""}${c.set ? ` ${c.set}` : ""}</li>`).join("")
  }</ul>`;
}

function ctaButton(href: string, label: string): string {
  return `<p style="margin:24px 0 8px">
    <a href="${href}" style="background:#EF9F27;color:#412402;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">${label}</a>
  </p>`;
}

interface TradeEmailOpts {
  recipientName: string;
  otherName:     string;
  tradeUrl:      string;
  theirCards:    { player: string; year?: number | null; set?: string | null }[];
  yourCards:     { player: string; year?: number | null; set?: string | null }[];
  message?:      string | null;
}

export function tradeProposalReceivedHtml(o: TradeEmailOpts): string {
  return tradeShell(`
    <h2 style="color:#042C53;margin:0 0 16px">New trade proposal from ${o.otherName}</h2>
    <p style="color:#334155;line-height:1.6">${o.otherName} would like to trade with you.</p>
    <p style="color:#334155;margin:16px 0 4px"><strong>They&rsquo;re offering:</strong></p>
    ${cardList(o.otherName ? o.theirCards : [])}
    <p style="color:#334155;margin:16px 0 4px"><strong>For your:</strong></p>
    ${cardList(o.yourCards)}
    ${o.message ? `<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin:16px 0;color:#78350f;font-style:italic">&ldquo;${o.message}&rdquo;</div>` : ""}
    ${ctaButton(o.tradeUrl, "Review trade →")}
  `, `Trade proposal — review at thecardcloud.com`);
}

export function tradeCounterOfferHtml(o: TradeEmailOpts): string {
  return tradeShell(`
    <h2 style="color:#042C53;margin:0 0 16px">${o.otherName} sent a counter-offer</h2>
    <p style="color:#334155;line-height:1.6">Here&rsquo;s where things stand now:</p>
    <p style="color:#334155;margin:16px 0 4px"><strong>They&rsquo;re offering:</strong></p>
    ${cardList(o.theirCards)}
    <p style="color:#334155;margin:16px 0 4px"><strong>For your:</strong></p>
    ${cardList(o.yourCards)}
    ${o.message ? `<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin:16px 0;color:#78350f;font-style:italic">&ldquo;${o.message}&rdquo;</div>` : ""}
    ${ctaButton(o.tradeUrl, "Review counter →")}
  `, `Counter-offer — review at thecardcloud.com`);
}

export function tradeAcceptedHtml(o: Pick<TradeEmailOpts, "recipientName" | "otherName" | "tradeUrl">): string {
  return tradeShell(`
    <h2 style="color:#042C53;margin:0 0 16px">Trade accepted! 🎉</h2>
    <p style="color:#334155;line-height:1.6">Both you and ${o.otherName} have agreed on terms.</p>
    <p style="color:#334155;line-height:1.6"><strong>What happens next:</strong></p>
    <ol style="color:#334155;line-height:1.7">
      <li>Print your packing slip from the trade page.</li>
      <li>Ship your cards to The Card Cloud (address on the slip).</li>
      <li>Paste your tracking number on the trade page.</li>
      <li>The Card Cloud verifies both shipments and forwards each side to the other party.</li>
    </ol>
    ${ctaButton(o.tradeUrl, "Open trade →")}
  `, `Trade accepted — pack and ship`);
}

export function tradeDeclinedHtml(o: Pick<TradeEmailOpts, "recipientName" | "otherName" | "tradeUrl">): string {
  return tradeShell(`
    <h2 style="color:#042C53;margin:0 0 16px">Trade declined</h2>
    <p style="color:#334155;line-height:1.6">${o.otherName} declined your proposal. The cards are no longer locked — feel free to propose another trade.</p>
    ${ctaButton(o.tradeUrl, "View trade →")}
  `, `Trade declined`);
}

export function tradeReceivedByCardCloudHtml(o: Pick<TradeEmailOpts, "recipientName" | "otherName" | "tradeUrl"> & { whoShipped: "you" | "other" }): string {
  const whose = o.whoShipped === "you" ? "Your cards have arrived" : `${o.otherName}&rsquo;s cards have arrived`;
  const body  = o.whoShipped === "you"
    ? `<p style="color:#334155;line-height:1.6">The Card Cloud received your shipment. We&rsquo;ll forward your cards to ${o.otherName} once both packages are in hand.</p>`
    : `<p style="color:#334155;line-height:1.6">The Card Cloud received ${o.otherName}&rsquo;s shipment. We&rsquo;ll forward their cards to you once your shipment arrives.</p>`;
  return tradeShell(`
    <h2 style="color:#042C53;margin:0 0 16px">${whose} at Card Cloud</h2>
    ${body}
    ${ctaButton(o.tradeUrl, "View trade →")}
  `, `Trade update — package received`);
}

export function tradeShippedFromCardCloudHtml(o: Pick<TradeEmailOpts, "recipientName" | "otherName" | "tradeUrl"> & { trackingNumber: string }): string {
  return tradeShell(`
    <h2 style="color:#042C53;margin:0 0 16px">Your trade cards are on the way!</h2>
    <p style="color:#334155;line-height:1.6">The Card Cloud has shipped ${o.otherName}&rsquo;s cards to you.</p>
    <p style="color:#334155;margin:12px 0"><strong>Tracking:</strong> <code style="background:#f1f5f9;padding:4px 8px;border-radius:4px">${o.trackingNumber}</code></p>
    <p style="color:#334155;line-height:1.6">Confirm receipt on the trade page once the package arrives.</p>
    ${ctaButton(o.tradeUrl, "View trade →")}
  `, `Trade update — shipped from Card Cloud`);
}

export function tradeCompleteHtml(o: Pick<TradeEmailOpts, "recipientName" | "otherName" | "tradeUrl">): string {
  return tradeShell(`
    <h2 style="color:#042C53;margin:0 0 16px">Trade complete 🎉</h2>
    <p style="color:#334155;line-height:1.6">Both parties have confirmed receipt. Your trade with ${o.otherName} is officially complete.</p>
    <p style="color:#334155;line-height:1.6">Enjoy your new cards!</p>
    ${ctaButton(o.tradeUrl, "View trade →")}
  `, `Trade complete`);
}

export function tradeDisputeOpenedHtml(o: Pick<TradeEmailOpts, "recipientName" | "otherName" | "tradeUrl"> & { reason: string; opener: "you" | "other" }): string {
  const lead = o.opener === "you"
    ? `Your dispute has been logged. The Card Cloud admin will reach out to both parties shortly.`
    : `${o.otherName} has opened a dispute on this trade.`;
  return tradeShell(`
    <h2 style="color:#042C53;margin:0 0 16px">Dispute opened</h2>
    <p style="color:#334155;line-height:1.6">${lead}</p>
    <div style="background:#fee2e2;border-left:4px solid #ef4444;padding:12px;margin:16px 0;color:#7f1d1d">
      <strong>Reason:</strong> ${o.reason}
    </div>
    ${ctaButton(o.tradeUrl, "View trade →")}
  `, `Trade dispute — admin will follow up`);
}
