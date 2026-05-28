/**
 * Shared Claude API client with automatic prompt caching.
 *
 * CACHING PATTERN
 * ───────────────
 * Prompt caching is a prefix match: any byte change anywhere in the prefix
 * invalidates everything after it. The render order is:
 *   tools → system → messages
 *
 * Every `claudeMessage()` call puts the static system prompt in a cached
 * system block automatically. First call in a 5-minute window pays full price
 * and writes the cache; every subsequent call reads from cache at ~10% cost.
 *
 * USAGE RULE
 * ──────────
 * Never instantiate `new Anthropic()` elsewhere in this project.
 * All Claude calls go through `claudeMessage()` so caching is never forgotten.
 *
 * Example:
 *   const response = await claudeMessage({
 *     system: MY_CONSTANT_INSTRUCTIONS,   // cached automatically
 *     userContent: [{ type: "text", text: dynamicUserInput }],
 *     model: "claude-haiku-4-5-20251001",
 *     maxTokens: 1024,
 *   });
 */

import Anthropic from "@anthropic-ai/sdk";

// ── Singleton client ──────────────────────────────────────────────────────────

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Re-exported types for callers ─────────────────────────────────────────────

export type UserContent      = Anthropic.MessageParam["content"];
export type TextBlockParam   = Anthropic.TextBlockParam;
export type ImageBlockParam  = Anthropic.ImageBlockParam;
export type AnthropicMessage = Anthropic.Message;

// ── Core helper ───────────────────────────────────────────────────────────────

interface ClaudeMessageOptions {
  /** Static instructions — identical on every call. Cached automatically. */
  system: string;
  /** Per-call content — images, dynamic text, conversation history, etc. */
  userContent: UserContent;
  model: string;
  maxTokens?: number;
}

/**
 * Send a message to Claude with the system prompt automatically cached.
 *
 * The system block always gets `cache_control: { type: "ephemeral" }`, so:
 *  - First call: writes cache, costs 1.25× input tokens for the system block
 *  - Repeat calls within 5 min: reads cache, costs 0.1× for that block (~90% off)
 *
 * Keep the system prompt truly static (no timestamps, no per-user data).
 * Dynamic context belongs in `userContent`, after the last cache breakpoint.
 */
export async function claudeMessage({
  system,
  userContent,
  model,
  maxTokens = 1024,
}: ClaudeMessageOptions): Promise<Anthropic.Message> {
  return anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: [
      {
        type:          "text",
        text:          system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  });
}
