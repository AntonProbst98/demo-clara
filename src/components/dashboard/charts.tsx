"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CountBucket } from "@/lib/metrics";
import { formatUSD, formatNumber } from "@/lib/format";

type Metric = "amount" | "count";

// Severity tones for the DPD buckets (ordinal risk → status palette, not a
// decorative rainbow). Buckets always arrive in fixed severity order.
const DPD_TONE: Record<string, string> = {
  "1-30": "var(--good)",
  "31-60": "var(--warning)",
  "61-90": "var(--warning)",
  "91-180": "var(--critical)",
  "181-365": "var(--critical)",
  "365+": "var(--critical)",
};

function fmt(metric: Metric, v: number) {
  return metric === "amount" ? formatUSD(v) : formatNumber(v);
}

function CustomTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: CountBucket }>;
  metric: Metric;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 shadow-sm">
      <div className="text-[12px] font-semibold text-ink">{d.label}</div>
      <div className="tnum mt-0.5 text-[12px] text-ink-secondary">
        {metric === "amount" ? (
          <>
            {formatUSD(d.amount ?? 0)}
            <span className="text-ink-muted"> · {d.value} accounts</span>
          </>
        ) : (
          <>
            {formatNumber(d.value)} accounts
            {d.amount != null && (
              <span className="text-ink-muted"> · {formatUSD(d.amount)}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Horizontal bars. Single reserved hue by default (magnitude comparison across
 * categories); pass `severity` to color DPD buckets by risk instead.
 */
export function HBarChart({
  data,
  metric,
  severity = false,
  emptyLabel = "No data yet.",
}: {
  data: CountBucket[];
  metric: Metric;
  severity?: boolean;
  emptyLabel?: string;
}) {
  if (!data.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-[13px] text-ink-muted">
        {emptyLabel}
      </div>
    );
  }

  const dataKey = metric === "amount" ? "amount" : "value";
  const height = Math.max(data.length * 44 + 16, 140);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
        barCategoryGap={10}
      >
        <XAxis type="number" dataKey={dataKey} hide />
        <YAxis
          type="category"
          dataKey="label"
          width={92}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--ink-secondary)", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "var(--neutral-wash)" }}
          content={<CustomTooltip metric={metric} />}
        />
        <Bar
          dataKey={dataKey}
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
          isAnimationActive={false}
          label={{
            position: "right",
            formatter: (v: number) => fmt(metric, v),
            fill: "var(--ink-secondary)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {data.map((d) => (
            <Cell
              key={d.key}
              fill={
                severity ? DPD_TONE[d.key] ?? "var(--series-1)" : "var(--series-1)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
