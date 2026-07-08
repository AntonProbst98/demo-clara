import type { Account } from "./types";

// Semantic status tokens. These map to CSS classes defined in globals.css so the
// status palette is fixed and reused everywhere (never re-invented per component).
export type StatusTone = "good" | "warning" | "critical" | "neutral";

/** DPD severity: green < 30, amber 31–90, red > 90. */
export function dpdTone(dpd: number): StatusTone {
  if (dpd <= 30) return "good";
  if (dpd <= 90) return "warning";
  return "critical";
}

/** FPD (first-payment default) is the elevated-risk segment. */
export function segmentTone(segment: Account["segment"]): StatusTone {
  return segment === "FPD" ? "critical" : "neutral";
}

/** A short, human label for the current recommendation state of an account. */
export function recommendationState(account: Account): "recommended" | "review" {
  return account.recommended_policy && !account.needs_review
    ? "recommended"
    : "review";
}

/**
 * Human-readable data-quality flag. The pipeline emits a single "Invalid DPD
 * (<=0)" for both negative and zero DPD; split it at display time (keyed on the
 * account's actual value) so a negative DPD reads self-explanatory on screen —
 * e.g. a payment posted with a future/miscaptured date rather than a real delay.
 */
export function describeFlag(flag: string, account: Account): string {
  if (flag === "Invalid DPD (<=0)") {
    if (account.dpd_days != null && account.dpd_days < 0) {
      return `Invalid DPD (negative: ${account.dpd_days})`;
    }
    return "Invalid DPD (zero)";
  }
  return flag;
}
