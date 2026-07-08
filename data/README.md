# Data flow — the Internal Collections book

This app is the **Internal Collections team's** tool, so it consumes **only** the
accounts routed to their channel — never the full portfolio. That narrowing is an
explicit, reproducible stage in the flow, not a hidden filter inside the app.

```
cleaned_accounts.json          all channels, cleaned + validated + policy-scored
        │                      (2,163 accounts — the upstream export)
        ▼
  Route · Channel              keep collections_channel === "Internal collections"
        │                      • n8n node in ../collections_pipeline_n8n.json
        │                      • code twin: `npm run data:internal`
        ▼
internal_accounts.json         the Internal collections book
        │                      (151 accounts · 119 workable · $7.34M · metadata
        ▼                       recomputed over the scoped set)
   the app (loadCleanedData in src/lib/data.ts)
        │
        ▼
   Workspace / Daily Progress → promises → CSV export
```

## Files

- **`cleaned_accounts.json`** — full cleaned export, every channel. Upstream input;
  not read by the app directly.
- **`internal_accounts.json`** — generated, the app's actual data source. Rebuild
  with `npm run data:internal` whenever `cleaned_accounts.json` changes.

## Why scoped

The case defines four channels (Internal collections, External agency 1/2,
External Bureau of Credit, AI bot) and states the team decided to focus on the
**Internal collections** team. The other ~2,000 accounts are worked by external
agencies / bureau / the AI bot and are out of scope for this tool. The scoped
book still exercises all three policy levers and both segments, so nothing about
the demo is lost.

The `Route · Channel` node in `collections_pipeline_n8n.json` and the
`scripts/build-internal-book.mjs` script are two representations of the **same**
routing step — keep them in sync.
