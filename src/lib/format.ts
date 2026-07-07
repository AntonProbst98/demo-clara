// Presentation helpers. Money and counts are always formatted here so no raw
// float ever reaches the screen.

const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const num = new Intl.NumberFormat("en-US");

/** Whole-dollar currency: $1,235 — for aggregates and KPI figures. */
export function formatUSD(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return usdWhole.format(value);
}

/** Exact currency with cents: $1,234.56 — for account-level money. */
export function formatUSDExact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return usdCents.format(value);
}

/** Compact currency: $1.2M — for tight chart axes and large hero figures. */
export function formatUSDCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return usdCompact.format(value);
}

/** Thousands-separated integer. */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return num.format(value);
}

/** Human date from an ISO string: Jul 7, 2026. */
export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
