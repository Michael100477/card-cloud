/**
 * Activity logger — fire-and-forget so it never slows down request handlers.
 * Server-only: imports db. Do not import from client components.
 */

import { db } from "./db";

export type LogLevel    = "info" | "warn" | "error";
export type LogCategory = "system" | "user" | "activity" | "ebay" | "auth" | "admin";

export interface LogOptions {
  level:       LogLevel;
  category:    LogCategory;
  action:      string;          // dot-notation: "ebay.listing.failed"
  message:     string;
  data?:       Record<string, unknown>;
  userId?:     string | null;
  targetId?:   string | null;   // orderId, listingId, cardId, userId…
  targetType?: string | null;   // "order" | "listing" | "card" | "user"
  ipAddress?:  string | null;
}

export function log(opts: LogOptions): void {
  // Fire-and-forget — never awaited so it can't block the caller
  db.activityLog.create({
    data: {
      level:      opts.level,
      category:   opts.category,
      action:     opts.action,
      message:    opts.message,
      data:       opts.data ? JSON.parse(JSON.stringify(opts.data)) : undefined,
      userId:     opts.userId   ?? null,
      targetId:   opts.targetId ?? null,
      targetType: opts.targetType ?? null,
      ipAddress:  opts.ipAddress ?? null,
    },
  }).catch(e => {
    // Never let logging failures surface to the caller
    console.error("[logger] Failed to write log:", e);
  });
}

// ── Convenience wrappers ─────────────────────────────────────────────────────

export const logger = {
  info:  (opts: Omit<LogOptions, "level">) => log({ ...opts, level: "info"  }),
  warn:  (opts: Omit<LogOptions, "level">) => log({ ...opts, level: "warn"  }),
  error: (opts: Omit<LogOptions, "level">) => log({ ...opts, level: "error" }),
};
