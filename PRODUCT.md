# PRODUCT.md — Collections Copilot

> Design brief and product context. This file is the single source of truth for
> *who* this is for, *how* it should feel, and *what it must never look like*.
> It stands in for an `/impeccable init` run (that command was unavailable in this
> environment); every UI decision in the app traces back to a line here.

## What it is

An internal tool for a B2B fintech (Clara) collections team. Two audiences:

1. **Collections agent** — works a queue of delinquent business accounts one at a
   time, on the phone. Needs to see the account, the pre-computed policy, generate
   a call script, and log a promise-to-pay in seconds. Speed and zero ambiguity
   matter more than delight.
2. **Supervisor** — reviews the day's progress: who was contacted, how much was
   committed, and the health/quality of the portfolio and the data.

## Users & context of use

- Used all day, every day, on a desk monitor. Dense information is a feature, not a
  bug — agents want everything on one screen without scrolling for the critical bits.
- High-stakes numbers (money, days past due). Misreading a figure has real cost, so
  hierarchy and legibility win over decoration.
- Regulated domain: scripts must be compliant, respectful, no threats. The tool
  should feel like it takes that seriously.

## Brand voice

Calm. Clinical. Trustworthy. Financial-grade. No hype, no exclamation marks, no
emoji in the product chrome. Copy is plain and precise: "Amount due", not
"Amount owed 💸". Labels are nouns; actions are verbs.

## Aesthetic target

Brex / Ramp / Stripe-grade. The look is **ink on paper with restraint**:

- A near-white paper plane and a hair-line-bordered white surface for cards.
- One reserved accent (a deep, desaturated blue) used sparingly for primary action
  and focus — never as a fill for large areas.
- Status carries meaning through a small, fixed palette (green / amber / red) used
  only for state, always paired with a label — never decoration.
- Generous but not loose spacing; a strict 4px rhythm. Hairline dividers, not boxes
  inside boxes.
- Tabular numerals everywhere money or counts align in columns.
- Type: one UI sans (Inter), tight tracking on headings, small uppercase eyebrow
  labels for section headers.

## Anti-references (do NOT do these)

These are hard "no"s. `/impeccable detect` equivalents to self-check against before
shipping:

- ❌ Purple gradients / any multi-stop gradient as a surface or accent.
- ❌ Glassmorphism (blurred translucent panels).
- ❌ Gradient text / text with a color-fill effect.
- ❌ "AI-slop" candy palettes — saturated teal-to-pink, neon, rainbow category colors.
- ❌ Side-stripe accent borders on cards (the colored left-edge cliché).
- ❌ Over-rounding — no pill-everything; radii stay small and consistent (6–10px).
- ❌ Drop shadows used for decoration; elevation is earned, subtle, and rare.
- ❌ Center-aligned dense data. Numbers are right-aligned, labels left-aligned.

## Architecture principle (state it plainly in the UI where relevant)

Policy and discount decisions are **deterministic and pre-computed** upstream
(n8n pipeline) and arrive in the data. The app **consumes** them; it never
re-derives them. The **only** use of the LLM (Gemini) is turning a known,
already-decided policy into natural-language Spanish call script text.

> Arithmetic and rules = code & data. Language = LLM.

This is a feature to surface, not hide: it's why the tool can be trusted with money.
