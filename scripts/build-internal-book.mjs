// === Route · Channel — build the Internal Collections book (code twin of n8n) ===
//
// This is the reproducible, code twin of the `Route · Channel` node in
// collections_ingest_webhook_n8n.json. It takes the full cleaned export
// (data/cleaned_accounts.json — every collections channel) and narrows it to
// ONLY the accounts the Internal Collections team works, then recomputes the
// metadata summary over that scoped book and writes data/internal_accounts.json.
//
// Why this exists as an explicit stage (not a silent filter in the app):
// the data flow is itself a deliverable. Only the correct data should fall into
// the app, and *where* it narrows must be legible end-to-end.
//
//   cleaned_accounts.json (all channels)
//        → Route · Channel  (this script ≡ the n8n IF node)
//        → internal_accounts.json (Internal collections book)
//        → the Collections Copilot app
//
// Run:  npm run data:internal

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// The single channel this tool serves. Other channels (External agency 1/2,
// External Bureau of Credit, AI bot) are worked elsewhere and are out of scope.
const INTERNAL_CHANNEL = "Internal collections";

const DATA_DIR = path.join(process.cwd(), "data");
const SOURCE = path.join(DATA_DIR, "cleaned_accounts.json");
const DEST = path.join(DATA_DIR, "internal_accounts.json");

// Recompute the portfolio summary over whatever set of accounts we're given, so
// the app's metadata always matches the rows actually shipped to it.
function deriveMetadata(accounts, provenance = {}) {
  const counts = {};
  for (const a of accounts) {
    counts[a.company_uuid] = (counts[a.company_uuid] || 0) + 1;
  }
  const duplicateUuids = Object.values(counts).filter((n) => n > 1).length;

  const exposure = accounts.reduce((sum, a) => {
    const v = Number(a.amount_due_usd);
    return sum + (Number.isNaN(v) || v <= 0 ? 0 : v);
  }, 0);

  return {
    generated_by: provenance.generated_by ?? "route-channel script",
    pipeline_version: provenance.pipeline_version ?? "1.0.0",
    scoped_to: INTERNAL_CHANNEL,
    total_records: accounts.length,
    workable_records: accounts.filter((a) => a.workable).length,
    needs_review_records: accounts.filter((a) => a.needs_review).length,
    pending_review_records: accounts.filter(
      (a) => a.record_status === "Pending_review",
    ).length,
    duplicate_uuids_detected: duplicateUuids,
    total_portfolio_exposure_usd: Math.round(exposure * 100) / 100,
  };
}

async function main() {
  const raw = JSON.parse(await readFile(SOURCE, "utf-8"));
  if (!Array.isArray(raw.accounts)) {
    throw new Error(`Malformed source ${SOURCE}: expected { accounts: [...] }`);
  }

  const internal = raw.accounts.filter(
    (a) => a.collections_channel === INTERNAL_CHANNEL,
  );

  const output = {
    metadata: deriveMetadata(internal, raw.metadata ?? {}),
    accounts: internal,
  };

  await writeFile(DEST, JSON.stringify(output, null, 2) + "\n", "utf-8");

  const m = output.metadata;
  const usd = m.total_portfolio_exposure_usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  console.log(`Route · Channel → "${INTERNAL_CHANNEL}"`);
  console.log(`  source:  ${raw.accounts.length} accounts (all channels)`);
  console.log(`  scoped:  ${m.total_records} accounts → ${path.relative(process.cwd(), DEST)}`);
  console.log(
    `  summary: ${m.workable_records} workable · ${m.needs_review_records} needs review · ` +
      `${m.pending_review_records} pending · ${m.duplicate_uuids_detected} dup UUIDs · ${usd} exposure`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
