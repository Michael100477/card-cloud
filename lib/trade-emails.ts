// Centralizes trade-notification email sending so every status-change route can
// fire a notification with one call. Each function fetches the trade context,
// builds the right template per side, and sends via sendTransactionalEmail().

import { db } from "./db";
import {
  sendTransactionalEmail,
  tradeProposalReceivedHtml,
  tradeCounterOfferHtml,
  tradeAcceptedHtml,
  tradeDeclinedHtml,
  tradeReceivedByCardCloudHtml,
  tradeShippedFromCardCloudHtml,
  tradeCompleteHtml,
  tradeDisputeOpenedHtml,
} from "./transactional-email";

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001";
}

async function loadTrade(tradeId: string) {
  return db.trade.findUnique({
    where: { id: tradeId },
    include: {
      initiator: { select: { id: true, email: true, displayName: true, username: true } },
      target:    { select: { id: true, email: true, displayName: true, username: true } },
      revisions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { cards: { include: { card: { select: { player: true, year: true, set: true } } } } },
      },
    },
  });
}

type UserSummary = { id: string; email: string; displayName: string | null; username: string | null };
const name = (u: UserSummary | null | undefined) =>
  u?.displayName ?? u?.username ?? u?.email ?? "Trader";

const safeSend = (to: string, subject: string, html: string) =>
  sendTransactionalEmail({ to, subject, html }).catch(e =>
    console.error(`[trade-email] failed to send "${subject}" to ${to}:`, e)
  );

/** New proposal sent → notify the target (the person whose card was requested). */
export async function emailProposalCreated(tradeId: string) {
  const trade = await loadTrade(tradeId);
  if (!trade) return;
  const rev = trade.revisions[0];
  if (!rev) return;
  const url = `${baseUrl()}/trades/${trade.id}`;
  const initiatorCards = rev.cards.filter(c => c.side === "initiator").map(c => c.card);
  const targetCards    = rev.cards.filter(c => c.side === "target").map(c => c.card);

  // Target sees: "they offer X, you give Y"
  await safeSend(
    trade.target.email,
    `${name(trade.initiator)} wants to trade with you`,
    tradeProposalReceivedHtml({
      recipientName: name(trade.target),
      otherName:     name(trade.initiator),
      tradeUrl:      url,
      theirCards:    initiatorCards,
      yourCards:     targetCards,
      message:       rev.message,
    }),
  );
}

/** Counter-offer → notify the OTHER party (the one who didn't make this revision). */
export async function emailCounterOffer(tradeId: string) {
  const trade = await loadTrade(tradeId);
  if (!trade) return;
  const rev = trade.revisions[0];
  if (!rev) return;
  const url = `${baseUrl()}/trades/${trade.id}`;

  // Identify the recipient (the one who did NOT propose this revision)
  const counterer = rev.proposedById === trade.initiator.id ? trade.initiator : trade.target;
  const recipient = rev.proposedById === trade.initiator.id ? trade.target    : trade.initiator;

  // Cards from the recipient's POV — "their cards" = the counterer's; "your cards" = recipient's
  const theirCards = rev.cards.filter(c =>
    (c.side === "initiator" && counterer.id === trade.initiator.id) ||
    (c.side === "target"    && counterer.id === trade.target.id)
  ).map(c => c.card);
  const yourCards = rev.cards.filter(c =>
    (c.side === "initiator" && recipient.id === trade.initiator.id) ||
    (c.side === "target"    && recipient.id === trade.target.id)
  ).map(c => c.card);

  await safeSend(
    recipient.email,
    `${name(counterer)} sent a counter-offer`,
    tradeCounterOfferHtml({
      recipientName: name(recipient),
      otherName:     name(counterer),
      tradeUrl:      url,
      theirCards,
      yourCards,
      message:       rev.message,
    }),
  );
}

/** Trade accepted → notify BOTH parties with shipping instructions. */
export async function emailAccepted(tradeId: string) {
  const trade = await loadTrade(tradeId);
  if (!trade) return;
  const url = `${baseUrl()}/trades/${trade.id}`;
  await Promise.all([
    safeSend(trade.initiator.email, `Trade accepted — pack and ship`,
      tradeAcceptedHtml({ recipientName: name(trade.initiator), otherName: name(trade.target),    tradeUrl: url })),
    safeSend(trade.target.email,    `Trade accepted — pack and ship`,
      tradeAcceptedHtml({ recipientName: name(trade.target),    otherName: name(trade.initiator), tradeUrl: url })),
  ]);
}

/** Trade declined → notify the OTHER party (the one who proposed the now-rejected offer). */
export async function emailDeclined(tradeId: string, declinedByUserId: string) {
  const trade = await loadTrade(tradeId);
  if (!trade) return;
  const url = `${baseUrl()}/trades/${trade.id}`;
  const decliner = declinedByUserId === trade.initiator.id ? trade.initiator : trade.target;
  const recipient = declinedByUserId === trade.initiator.id ? trade.target    : trade.initiator;
  await safeSend(
    recipient.email,
    `Trade declined`,
    tradeDeclinedHtml({ recipientName: name(recipient), otherName: name(decliner), tradeUrl: url }),
  );
}

/** Admin marked inbound shipment received → tell BOTH parties. */
export async function emailInboundReceived(tradeId: string, side: "initiator" | "target") {
  const trade = await loadTrade(tradeId);
  if (!trade) return;
  const url = `${baseUrl()}/trades/${trade.id}`;
  const shipper = side === "initiator" ? trade.initiator : trade.target;
  const other   = side === "initiator" ? trade.target    : trade.initiator;
  await Promise.all([
    safeSend(shipper.email, `Card Cloud has your shipment`,
      tradeReceivedByCardCloudHtml({ recipientName: name(shipper), otherName: name(other), tradeUrl: url, whoShipped: "you" })),
    safeSend(other.email,   `Card Cloud has ${name(shipper)}'s shipment`,
      tradeReceivedByCardCloudHtml({ recipientName: name(other),   otherName: name(shipper), tradeUrl: url, whoShipped: "other" })),
  ]);
}

/** Admin marked outbound shipped → tell the recipient of THAT shipment. */
export async function emailOutboundShipped(tradeId: string, sideShippedTo: "initiator" | "target", trackingNumber: string) {
  const trade = await loadTrade(tradeId);
  if (!trade) return;
  const url = `${baseUrl()}/trades/${trade.id}`;
  const recipient = sideShippedTo === "initiator" ? trade.initiator : trade.target;
  const other     = sideShippedTo === "initiator" ? trade.target    : trade.initiator;
  await safeSend(
    recipient.email,
    `Your trade cards are on the way`,
    tradeShippedFromCardCloudHtml({ recipientName: name(recipient), otherName: name(other), tradeUrl: url, trackingNumber }),
  );
}

/** Trade flipped to complete (both sides confirmed receipt) → tell BOTH parties. */
export async function emailComplete(tradeId: string) {
  const trade = await loadTrade(tradeId);
  if (!trade) return;
  const url = `${baseUrl()}/trades/${trade.id}`;
  await Promise.all([
    safeSend(trade.initiator.email, `Trade complete`,
      tradeCompleteHtml({ recipientName: name(trade.initiator), otherName: name(trade.target),    tradeUrl: url })),
    safeSend(trade.target.email,    `Trade complete`,
      tradeCompleteHtml({ recipientName: name(trade.target),    otherName: name(trade.initiator), tradeUrl: url })),
  ]);
}

/** Dispute opened → notify BOTH parties (different framing) AND admin email if set. */
export async function emailDisputeOpened(tradeId: string, openedByUserId: string, reason: string) {
  const trade = await loadTrade(tradeId);
  if (!trade) return;
  const url = `${baseUrl()}/trades/${trade.id}`;
  const opener     = openedByUserId === trade.initiator.id ? trade.initiator : trade.target;
  const otherParty = openedByUserId === trade.initiator.id ? trade.target    : trade.initiator;

  await Promise.all([
    safeSend(opener.email,     `Dispute logged — Card Cloud will follow up`,
      tradeDisputeOpenedHtml({ recipientName: name(opener),     otherName: name(otherParty), tradeUrl: url, reason, opener: "you" })),
    safeSend(otherParty.email, `${name(opener)} has opened a dispute`,
      tradeDisputeOpenedHtml({ recipientName: name(otherParty), otherName: name(opener),     tradeUrl: url, reason, opener: "other" })),
  ]);

  // Also notify the admin email if configured
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    await safeSend(
      adminEmail,
      `[ADMIN] Trade dispute on ${trade.id.slice(-8).toUpperCase()}`,
      tradeDisputeOpenedHtml({ recipientName: "Admin", otherName: `${name(opener)} vs ${name(otherParty)}`, tradeUrl: `${baseUrl()}/admin/trades/${trade.id}`, reason, opener: "other" }),
    );
  }
}
