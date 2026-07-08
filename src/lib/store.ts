import "server-only";
import type { CleanedData } from "./types";

// === Server-side store for the uploaded Internal collections book ===
//
// Vercel's runtime filesystem is read-only, so /api/ingest can't persist to disk
// in production. This uses Upstash Redis (free tier) via its REST API — no SDK,
// just fetch — so the cleaned book survives across serverless invocations and is
// shared between the ingest request and later page loads.
//
// Config: either the Vercel-KV-style names or the Upstash-native names work.
//   KV_REST_API_URL / KV_REST_API_TOKEN            (Vercel Storage → Redis)
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   (Upstash console)
//
// If neither is set (e.g. local dev), the store is considered absent and the
// caller falls back to the on-disk file.

const KEY = "collections_book";

function kvConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export function storeConfigured(): boolean {
  return kvConfig() !== null;
}

// Upstash REST accepts a Redis command as a JSON array posted to the base URL,
// and returns { result }. This handles large values (JSON in the body).
async function command(cmd: string[]): Promise<unknown> {
  const c = kvConfig();
  if (!c) throw new Error("Store not configured");
  const res = await fetch(c.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Store ${cmd[0]} responded ${res.status}`);
  const data = (await res.json()) as { result?: unknown };
  return data.result;
}

/** Read the persisted book, or null if none is stored / store is absent. */
export async function loadStoredBook(): Promise<CleanedData | null> {
  if (!storeConfigured()) return null;
  try {
    const result = await command(["GET", KEY]);
    if (typeof result !== "string" || !result) return null;
    const parsed = JSON.parse(result) as CleanedData;
    return parsed.accounts && parsed.metadata ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist the book. Returns false if the store isn't configured. Throws on a
 *  real store error so the route can report it. */
export async function saveStoredBook(book: CleanedData): Promise<boolean> {
  if (!storeConfigured()) return false;
  await command(["SET", KEY, JSON.stringify(book)]);
  return true;
}
