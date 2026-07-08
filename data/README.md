# Data flow — the Internal Collections book

This app is the **Internal Collections team's** tool, so it consumes **only** the
accounts routed to their channel — never the full portfolio. That narrowing is an
explicit, reproducible stage (`Route · Channel`), not a hidden filter in the app.

There are two ways the app's data source (`internal_accounts.json`) gets built.

## 1. Live ingest — CSV upload → n8n webhook (the connected path)

The `/import` page is the front door. An agent drops a raw **CSV or Excel
(.xlsx)** export; the app parses the file format and hands the rows to a **live
n8n webhook** that cleans, validates, policy-scores and routes them, then
persists the returned Internal collections book.

```
/import (drop CSV or .xlsx)
   → POST /api/ingest            app parses CSV/XLSX → rows
      → n8n Webhook (Production URL, N8N_INGEST_WEBHOOK_URL)
           Stage 1 Validate → Stage 2 Policy → Route · Channel → Stage 3 Assemble
        → Respond to Webhook   { metadata, accounts }  (internal book only)
   → data/internal_accounts.json
   → Workspace / Daily Progress
```

If the webhook is unset or unreachable, `/api/ingest` runs the **identical**
pipeline in-process (`src/lib/pipeline.ts`) and labels the result
`local-fallback` — the same anti-fragile pattern as the Gemini script route, so a
live demo is never blocked.

### Wiring n8n (one-time)

1. In n8n Cloud: **Import from File** → `collections_ingest_webhook_n8n.json`.
2. Open the **Webhook** node, **Activate** the workflow, copy the **Production URL**.
3. Put it in `.env.local`: `N8N_INGEST_WEBHOOK_URL=https://…/webhook/collections-ingest`
4. Restart `npm run dev`. Uploads now round-trip through n8n; the `/import` result
   badge shows **“Cleaned by n8n (live)”**.

> In production, swap the Webhook trigger for a **Schedule Trigger** reading the
> CRM/DB. Stages 1–3 and the routing are untouched — the pipeline is source-agnostic.

## 2. Batch / CLI — from a full cleaned export

When you already have the full cleaned export (`cleaned_accounts.json`, all
channels), regenerate the app's scoped book directly:

```
cleaned_accounts.json  →  npm run data:internal  →  internal_accounts.json
     (2,163, all channels)     Route · Channel        (151 · Internal collections)
```

`scripts/build-internal-book.mjs` is the code twin of the `Route · Channel` node.

## Files

- **`cleaned_accounts.json`** — full cleaned export, every channel. Upstream input;
  not read by the app directly.
- **`internal_accounts.json`** — generated, the app's actual data source. Rebuilt
  by either path above. Restore the default demo book with `npm run data:internal`.

## Why scoped

The case defines four channels (Internal collections, External agency 1/2,
External Bureau of Credit, AI bot) and states the team decided to focus on the
**Internal collections** team. The other ~2,000 accounts are worked by external
agencies / bureau / the AI bot and are out of scope for this tool. The scoped
book still exercises all three policy levers and both segments.

The `Route · Channel` node (in both `collections_pipeline_n8n.json` and
`collections_ingest_webhook_n8n.json`), `scripts/build-internal-book.mjs`, and
`src/lib/pipeline.ts` are four representations of the **same** routing step — keep
them in sync.
