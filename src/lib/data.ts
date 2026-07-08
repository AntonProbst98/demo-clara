import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { CleanedData } from "./types";
import { loadStoredBook } from "./store";

// Server-side loader for the Internal Collections book — the app is that team's
// tool, so it consumes ONLY the accounts routed to their channel, never the full
// portfolio. That narrowing is an explicit, documented pipeline stage, not a
// filter hidden here: `Route · Channel` in collections_pipeline_n8n.json,
// mirrored by `npm run data:internal`.
//
//   cleaned_accounts.json (all channels)
//     → Route · Channel  →  internal_accounts.json  →  this loader  →  the app
//
// Read order: an uploaded book in the KV store (set by /api/ingest, survives
// serverless writes) takes precedence; otherwise the committed default file.
// Runs only on the server (never shipped to the client).
const DATA_PATH = path.join(process.cwd(), "data", "internal_accounts.json");

export async function loadCleanedData(): Promise<CleanedData> {
  // An uploaded book persisted in the store wins over the bundled default.
  const stored = await loadStoredBook();
  if (stored) return stored;

  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as CleanedData;
    if (!parsed.accounts || !parsed.metadata) {
      throw new Error("Malformed data: expected { metadata, accounts }.");
    }
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Data file not found at ${DATA_PATH}. Generate it with \`npm run data:internal\` (routes cleaned_accounts.json to the Internal collections book).`,
      );
    }
    throw err;
  }
}
