---
target: /workspace
total_score: 27
p0_count: 1
p1_count: 2
timestamp: 2026-07-07T20-59-37Z
slug: src-app-workspace-page-tsx
---
Method: dual-agent (A: a7ee5c5fb13601851 · B: a8b39e9b65db672ba)

# Design Critique — Collections Agent Workspace (`/workspace`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Logging a promise produces no confirmation; form just clears |
| 2 | Match System / Real World | 3 | Strong domain language, undercut by a misbehaving utilization metric |
| 3 | User Control and Freedom | 2 | No keyboard escape/undo of the core loop; promise delete is immediate, no confirm |
| 4 | Consistency and Standards | 3 | Excellent internal consistency; `DPD_BUCKET_ORDER "0-30"` never matches data `"1-30"` |
| 5 | Error Prevention | 2 | Promise amount can exceed amount due; due date can be in the past; no guard |
| 6 | Recognition Rather Than Recall | 3 | Promise amount not prefilled from the figure the agent just read |
| 7 | Flexibility and Efficiency | 2 | Zero keyboard shortcuts in an all-day keyboard-driven tool |
| 8 | Aesthetic and Minimalist Design | 4 | Best-in-class restraint; ledger discipline |
| 9 | Error Recovery | 3 | Script fetch errors and form validation surfaced clearly |
| 10 | Help and Documentation | 2 | Only inline "Deterministic · pre-computed" label; no shortcut/help legend |
| **Total** | | **27/40** | **Acceptable — solid foundation, specific weak areas** |

## Anti-Patterns Verdict

**LLM assessment:** Not slop. This reads as a genuine Linear/Stripe-register tool. Every anti-reference in the brief is respected: no gradients, no glassmorphism, no gradient text, no candy palette, no side-stripe borders (selection uses a full 1px border + `--accent-wash` fill), radii stay 5–10px, no decorative shadows, data is left/right-disciplined not centered. Only tells: the `SparkIcon` sparkle on "Generate script" (mild, now category-accepted), and the app ships IBM Plex Sans/Mono instead of the brief's Inter (a defensible, deliberate deviation).

**Deterministic scan:** Detector ran clean — exit 0, empty array, on both the workspace scope and the whole `src` tree. Grep cross-check found zero hardcoded hex/rgb/hsl in markup, zero gradients, zero side-stripe borders, zero z-index literals, zero `!important`. The 7 inline styles are all token-driven (`var(--...)`). Arbitrary Tailwind px sizes (`text-[34px]` etc.) are heavy but permitted by the ruleset — worth a shared type-scale check, not a violation.

**Visual overlays:** Unavailable — no browser/screenshot tool exposed in this environment. Findings are verified against source and the real `data/cleaned_accounts.json` sample, not a rendered page.

**Agreement:** The detector and the LLM agree the surface is clean at the token/markup level. Everything of value here was caught by the human-style review — the real issues are behavioral (keyboard, confirmation, persistence, a data-integrity bug), which a static markup scan cannot see.

## Overall Impression

This is a disciplined, trustworthy surface that genuinely "disappears into the task" — the hard part (visual restraint, the trust story, ledger-grade numerals) is done well. What holds it back is not looks but **flow and safety**: the one action the whole screen exists for — logging a promise-to-pay — is silent, non-durable, below the fold, and typed by hand next to a trusted number it ignores. Biggest opportunity: make the promise the anchor of the interaction, not its tail.

## What's Working

1. **The trust story is surfaced exactly as the brief demands.** The "Deterministic · pre-computed" lock label plus the Gemini/Template source dot make the "arithmetic = code, language = LLM" architecture *visible* (`RecommendationZone.tsx:64-69, 135-151`). Best decision in the surface.
2. **The review-gate refuses to improvise.** When no policy was computed, `ReviewNotice` blocks the recommendation, explains why, and lists the exact data-quality flags to resolve (`RecommendationZone.tsx:171-205`) — the right behavior for a regulated domain. Turns "no data" into a safe, actionable state.
3. **Ledger-grade discipline.** Tabular mono numerals, hairline dividers (not boxes-in-boxes), one reserved blue accent, consistent numbered ZoneHeaders. Earns category familiarity.

## Priority Issues

**[P0] No keyboard shortcuts for the core loop.**
- Why it matters: The brief's #1 persona works a queue all day on the phone; "speed over delight." Queue nav, generate, copy, and every promise field are 100% pointer-driven (`Workspace.tsx:86-108`, `RecommendationZone.tsx:109,152-157`, `PromiseZone.tsx:76-119`). Reaching for the mouse hundreds of times a day is slow and a fatigue valley.
- Fix: `j/k` or `↑/↓` to move the queue, `/` to focus search, `g` generate, `c` copy, `Enter` to log, `[`/`]` prev/next; show a shortcut legend.
- Suggested command: `/impeccable optimize`

**[P1] The high-stakes action is silent and non-durable.**
- Why it matters: Logging a promise gives no confirmation — the form just clears (`PromiseZone.tsx:31-41`) — and nothing persists; `PromisesProvider` is in-memory (`PromisesProvider.tsx:13-15`), so one refresh vaporizes the day's promises. On a live call the agent needs certainty; a demo caveat here is a real product risk.
- Fix: Inline/toast confirmation ("Promise logged · $X due Jul 12") and persist to `localStorage`.
- Suggested command: `/impeccable harden`

**[P1] Promise form ignores the trusted numbers it sits beside.**
- Why it matters: The product thesis is "trusted, pre-computed arithmetic," yet the amount is free-form with only `>0` validation, due date accepts past dates, and nothing is prefilled (`PromiseZone.tsx:20-42, 76-101`). The one number the agent types can drift, unchecked, from `upfront_required_usd`/`amount_due_usd`.
- Fix: Prefill `upfront_required_usd` (or amount due), enforce `dueDate >= today`, warn (not block) when amount > amount due.
- Suggested command: `/impeccable harden`

**[P2] Uncapped utilization renders garbage figures.**
- Why it matters: `ClientDataZone.tsx:70-74` prints `amount_due/credit_line` uncapped → ~256,210% on the very first real record (`credit_line_usd: 50`, `amount_due_usd: 128105`). Directly violates "misreading a figure has real cost" — it's the one number on screen that looks broken.
- Fix: Cap/flag >100%, show `—` or a data-quality flag when the credit line is implausible; reconsider whether this "utilization" is the right metric.
- Suggested command: `/impeccable clarify`

**[P2] Single narrow column buries the promise form below the fold.**
- Why it matters: Main content is `max-w-3xl` single-column stacked and scrolled (`Workspace.tsx:75-84`); on a desk monitor the agent scrolls past the script to reach Zone 3 to log — but the brief says "everything on one screen without scrolling for the critical bits," and logging IS the critical bit.
- Fix: Two-column on wide screens (data + recommendation left; promise + nav as a sticky right rail), or make the promise zone/nav sticky.
- Suggested command: `/impeccable layout`

**[P3] Accessibility + duplicate-UUID identity bugs.**
- Why it matters: Search input is placeholder-only, no accessible name (`AccountQueue.tsx:68-75`). Selection/"contacted" are keyed by `company_uuid` alone while data reports `duplicate_uuids_detected: 3` — so one selection can highlight/mark two rows. `ReviewNotice` uses `border-[var(--warning)]/30`, a Tailwind opacity modifier on a CSS variable that may not compute — the compliance-critical warning border may not render.
- Fix: `aria-label` on search; key selected/contacted by the full row key; use a real token color for the warning border.
- Suggested command: `/impeccable harden`

## Cognitive Load

**~3 of 8 failures — moderate.** Density is *structured, not noisy*; the zone/eyebrow/token system does real work. Failures: (6) recall — promise amount not prefilled; (7) decision points — the DPD facet is 5 chips and the always-expanded filter stack can show 15+ chips at once; (5, partial) progressive disclosure — all five facet groups are permanently expanded above the queue (`AccountQueue.tsx:78-160`). The only genuinely noisy region is that always-open filter stack.

## Emotional Journey

- **Peak:** Generate → source dot goes green → Copy → paste into the call. Fast and legible. TopNav "N promises logged today" is a quiet running win.
- **Reassurance at the money moment:** Strong — amount due at 34px exact-cents tabular, upfront boxed and separated, the lock label and source badge all say "trust these numbers."
- **Valley 1:** The highest-stakes action (logging) is silent — "did that save?" anxiety mid-call.
- **Valley 2:** No persistence — a refresh erases the day.
- **Valley 3:** All-day pointer fatigue; every step is mouse-only.

## Persona Red Flags

**Alex (power user):** No keyboard path through the core loop — Previous/Next, Generate/Copy, and every promise field are pointer-only; filter chips are click-only. No way to work the queue fast without a mouse.

**Sam (accessibility):** Search input has no accessible name (placeholder only). DPD severity leans on the color of the 34px figure. `ReviewNotice` uses `border-[var(--warning)]/30` — an opacity modifier on a CSS-variable color that may not compute, so the compliance-critical warning border may not render for a low-vision user. Positives: real, consistent focus rings; delete button has an `aria-label`.

**Collections agent on a live call (project persona):** Must scroll from the script (Zone 2) down to the promise form (Zone 3) with a customer on the line; gets no confirmation the promise saved; must re-type the dollar amount just read a few pixels above; one accidental refresh erases every promise logged that day.

## Minor Observations

- `dpdTone` returns green for 30 DPD even on a $128k overdue balance (`account.ts:9-13`) — reads as "fine" at a glance.
- Amount due and DPD are both 34px (`ClientDataZone.tsx:36, 43`) — the single most important figure has no size lead.
- Export-all lives inside the per-account promise zone header (`PromiseZone.tsx:55-73`) — portfolio-wide action at account altitude.
- Queue is entirely hidden on mobile (`Workspace.tsx:63`) — no account switching on small screens (acceptable for a desk tool; make it a conscious call).
- Delete promise is destructive with no confirmation (`PromiseZone.tsx:162-169`).
- `DPD_BUCKET_ORDER "0-30"` vs data `"1-30"` mismatch (`metrics.ts:5`) — dead bucket string.

## Questions to Consider

1. If the agent is on the phone, why is *logging the promise* — the only reason this screen exists — the third stacked card below the fold instead of a persistent, always-visible rail?
2. The product preaches "deterministic arithmetic, LLM only for language," yet the one number the agent types (the promise amount) is free-form and never checked against `upfront_required_usd`. Should the trusted arithmetic *constrain* the promise, not just describe it?
3. Routing every figure through IBM Plex Mono is elegant, but does it flatten hierarchy so a 34px amount-due and a 12px channel count read as the same ledger row — is Inter with `tabular-nums` the more honest call?
