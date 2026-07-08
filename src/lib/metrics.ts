import type { Account, Promise } from "./types";

// Fixed display order for DPD buckets so charts/queues never sort them
// lexicographically ("181-365" before "31-60"). These labels MUST match the
// `dpd_bucket` values emitted by the upstream cleaning pipeline exactly —
// anything not listed here is dropped from charts and the queue filter.
export const DPD_BUCKET_ORDER = [
  "1-30",
  "31-60",
  "61-90",
  "91-180",
  "181-365",
  "365+",
];

export interface CountBucket {
  key: string;
  label: string;
  value: number;
  amount?: number;
}

export interface BookStats {
  assigned: number; // accounts routed to the internal channel
  actionable: number; // have a computed policy (valid financials)
  flagged: number; // needs review — no policy (bad/missing/duplicate data)
  collectibleExposure: number; // amount due across actionable accounts
  assignedExposure: number; // amount due across all assigned (positive amounts)
}

/**
 * Reconcile the internal book into the numbers the analysis leads with. An
 * account is "actionable" once the deterministic engine computed a policy for it
 * (recommended_policy != null); the rest are flagged for data review. So
 * collectible exposure excludes flagged accounts (bad DPD, missing/dup data).
 */
export function bookStats(accounts: Account[]): BookStats {
  const actionable = accounts.filter((a) => a.recommended_policy != null);
  const collectible = actionable.reduce(
    (s, a) => s + (a.amount_due_usd ?? 0),
    0,
  );
  const assignedExp = accounts.reduce((s, a) => {
    const v = a.amount_due_usd ?? 0;
    return s + (v > 0 ? v : 0);
  }, 0);
  return {
    assigned: accounts.length,
    actionable: actionable.length,
    flagged: accounts.length - actionable.length,
    collectibleExposure: Math.round(collectible * 100) / 100,
    assignedExposure: Math.round(assignedExp * 100) / 100,
  };
}

/**
 * Exposure (sum of amount_due) grouped by recommended policy lever. The book is
 * a single channel (Internal collections), so channel breakdown is meaningless
 * here; what the analyst prioritises by is which negotiation lever applies.
 */
export function exposureByPolicy(accounts: Account[]): CountBucket[] {
  const map = new Map<string, { count: number; amount: number }>();
  for (const a of accounts) {
    const key = a.recommended_policy ?? "Needs review";
    const cur = map.get(key) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += a.amount_due_usd ?? 0;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, label: key, value: v.count, amount: v.amount }))
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
}

/** Account count per DPD bucket, in fixed severity order. */
export function dpdDistribution(accounts: Account[]): CountBucket[] {
  const map = new Map<string, { count: number; amount: number }>();
  for (const a of accounts) {
    const cur = map.get(a.dpd_bucket) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += a.amount_due_usd;
    map.set(a.dpd_bucket, cur);
  }
  return DPD_BUCKET_ORDER.filter((b) => map.has(b)).map((b) => {
    const v = map.get(b)!;
    return { key: b, label: b, value: v.count, amount: v.amount };
  });
}

// ---- Promise-derived supervisor metrics (client state) ----

export interface DailySummary {
  accountsContacted: number;
  promisesLogged: number;
  committedValue: number;
}

/** Roll up the day's logged promises into the three headline KPIs. */
export function summarizePromises(promises: Promise[]): DailySummary {
  const contacted = new Set(promises.map((p) => p.accountUuid));
  const committed = promises.reduce((sum, p) => sum + p.amount, 0);
  return {
    accountsContacted: contacted.size,
    promisesLogged: promises.length,
    committedValue: committed,
  };
}

/** Committed value + promise count grouped by the policy in effect when logged. */
export function promisesByPolicy(promises: Promise[]): CountBucket[] {
  const map = new Map<string, { count: number; amount: number }>();
  for (const p of promises) {
    const key = p.policyAtLog ?? "Unspecified";
    const cur = map.get(key) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += p.amount;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, label: key, value: v.count, amount: v.amount }))
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
}
