// Ollama REST API client — talks to your local Ollama instance.

const BASE = process.env.OLLAMA_URL ?? "http://localhost:11434";

export interface OllamaModel {
  name:       string;
  size:       number;
  modified_at: string;
  details:    { family: string; parameter_size: string };
}

export interface RunningModel {
  name:        string;
  size_vram:   number;
  expires_at:  string;
}

// ─── Model management ─────────────────────────────────────────────────────────

export async function listModels(): Promise<OllamaModel[]> {
  const r = await fetch(`${BASE}/api/tags`);
  const d = await r.json();
  return d.models ?? [];
}

export async function getRunningModels(): Promise<RunningModel[]> {
  const r = await fetch(`${BASE}/api/ps`);
  const d = await r.json();
  return d.models ?? [];
}

export async function* pullModel(name: string): AsyncGenerator<{ status: string; completed?: number; total?: number }> {
  const r = await fetch(`${BASE}/api/pull`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ name }),
  });
  const reader = r.body!.getReader();
  const dec    = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = dec.decode(value).split("\n").filter(Boolean);
    for (const line of lines) {
      try { yield JSON.parse(line); } catch { /* partial chunk */ }
    }
  }
}

export async function deleteModel(name: string): Promise<void> {
  await fetch(`${BASE}/api/delete`, {
    method:  "DELETE",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ name }),
  });
}

// ─── Inference ────────────────────────────────────────────────────────────────

export interface InferenceResult {
  response:    string;
  model:       string;
  total_duration: number;  // nanoseconds
  done:        boolean;
}

export async function generate(
  model:   string,
  prompt:  string,
  images?: string[],  // base64-encoded
): Promise<InferenceResult> {
  const r = await fetch(`${BASE}/api/generate`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ model, prompt, images, stream: false }),
  });
  return r.json();
}

// Structured card recognition prompt for raw card images
export const RAW_CARD_PROMPT = `You are looking at a sports or trading card.
Read any text visible on the card itself (NOT any grading label) and extract:
- manufacturer: the company that made the card (Topps, Panini, Upper Deck, etc.)
- year: the card year if visible
- set: the product name (Topps Chrome, Prizm, etc.)
- subset: any subset or variation printed on the card (Refractor, etc.)
- player: the player name
- cardNumber: the card number if visible
- sport: Baseball, Football, Basketball, etc.

Return ONLY valid JSON. Use null for fields you cannot read.
Example: {"manufacturer":"Topps","year":1987,"set":"Topps","subset":"Future Stars","player":"Bo Jackson","cardNumber":"170","sport":"Baseball"}`;

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}
