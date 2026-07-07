import type { Account } from "./types";

export type StatusFilter = "all" | "workable" | "needs_review";

export interface QueueFilters {
  search: string;
  channels: string[];
  segments: string[];
  buckets: string[];
  status: StatusFilter;
}

export const EMPTY_FILTERS: QueueFilters = {
  search: "",
  channels: [],
  segments: [],
  buckets: [],
  status: "all",
};

function matchesStatus(a: Account, status: StatusFilter): boolean {
  if (status === "workable") return a.workable;
  if (status === "needs_review") return a.needs_review;
  return true;
}

/** Pure predicate — a single account against the active filters. */
export function accountMatches(a: Account, f: QueueFilters): boolean {
  if (!matchesStatus(a, f.status)) return false;
  if (f.channels.length && !f.channels.includes(a.collections_channel)) {
    return false;
  }
  if (f.segments.length && !f.segments.includes(a.segment)) return false;
  if (f.buckets.length && !f.buckets.includes(a.dpd_bucket)) return false;
  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    const hay = `${a.company_uuid} ${a.collections_channel} ${a.recommended_policy ?? ""} ${a.notes}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function applyFilters(accounts: Account[], f: QueueFilters): Account[] {
  return accounts.filter((a) => accountMatches(a, f));
}

/** Global count of accounts per value of a facet — drives the filter badges. */
export function facetCounts(
  accounts: Account[],
  key: "collections_channel" | "segment" | "dpd_bucket",
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const a of accounts) {
    const v = a[key];
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}
