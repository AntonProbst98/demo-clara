"use client";

import { useMemo } from "react";
import type { PortfolioMetadata } from "@/lib/types";
import {
  type CountBucket,
  promisesByPolicy,
  summarizePromises,
} from "@/lib/metrics";
import { usePromises } from "@/components/providers/PromisesProvider";
import { formatUSD, formatUSDCompact, formatNumber } from "@/lib/format";
import { StatTile } from "@/components/dashboard/StatTile";
import { HBarChart } from "@/components/dashboard/charts";

interface Props {
  metadata: PortfolioMetadata;
  policyExposure: CountBucket[];
  dpdBuckets: CountBucket[];
  accountCount: number;
}

export function Dashboard({
  metadata,
  policyExposure,
  dpdBuckets,
  accountCount,
}: Props) {
  const { promises } = usePromises();

  const summary = useMemo(() => summarizePromises(promises), [promises]);
  const byPolicy = useMemo(() => promisesByPolicy(promises), [promises]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-ink">
            Daily progress
          </h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            Today&apos;s collection activity and the health of the book behind
            it.
          </p>
        </div>
        <span className="text-[12px] text-ink-muted">
          Internal collections · {formatNumber(accountCount)} accounts
        </span>
      </div>

      {/* KPI row — today's activity */}
      <Section eyebrow="Today's activity">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            label="Accounts contacted"
            value={formatNumber(summary.accountsContacted)}
            sub={`${
              accountCount > 0
                ? Math.round((summary.accountsContacted / accountCount) * 100)
                : 0
            }% of loaded accounts`}
            hero
          />
          <StatTile
            label="Promises logged"
            value={formatNumber(summary.promisesLogged)}
            sub="Commitments captured today"
            hero
          />
          <StatTile
            label="Committed value"
            value={formatUSD(summary.committedValue)}
            sub="Total promised to pay"
            hero
            tone="good"
          />
        </div>
      </Section>

      {/* Promises by policy + data quality */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Promises by policy" subtitle="Committed value per policy type">
          <HBarChart
            data={byPolicy}
            metric="amount"
            emptyLabel="No promises logged yet — log one in the Workspace."
          />
        </Card>

        <Card
          title="Data quality"
          subtitle="Quality of your queue · upstream cleaning pipeline"
        >
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-1">
            <QualityStat
              label="Total records"
              value={formatNumber(metadata.total_records)}
            />
            <QualityStat
              label="Workable"
              value={formatNumber(metadata.workable_records)}
              tone="good"
            />
            <QualityStat
              label="Needs review"
              value={formatNumber(metadata.needs_review_records)}
              tone="warning"
            />
            <QualityStat
              label="Pending review"
              value={formatNumber(metadata.pending_review_records)}
            />
            <QualityStat
              label="Duplicate UUIDs"
              value={formatNumber(metadata.duplicate_uuids_detected)}
              tone={
                metadata.duplicate_uuids_detected > 0 ? "critical" : undefined
              }
            />
            <QualityStat
              label="Pipeline version"
              value={metadata.pipeline_version ?? "—"}
            />
          </div>
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <QualityBar
              workable={metadata.workable_records}
              review={metadata.needs_review_records}
              pending={metadata.pending_review_records}
            />
          </div>
        </Card>
      </div>

      {/* Book overview */}
      <Section eyebrow="Your book" className="mt-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <StatTile
            label="Total exposure"
            value={formatUSDCompact(metadata.total_portfolio_exposure_usd)}
            sub={`${formatUSD(
              metadata.total_portfolio_exposure_usd,
            )} across ${formatNumber(accountCount)} accounts`}
            hero
          />
          <div className="lg:col-span-2">
            <Card
              title="Exposure by policy"
              subtitle="Amount due by recommended policy lever"
              flush
            >
              <HBarChart data={policyExposure} metric="amount" />
            </Card>
          </div>
        </div>

        <div className="mt-4">
          <Card
            title="DPD bucket distribution"
            subtitle="Account count by days-past-due, colored by risk"
          >
            <HBarChart data={dpdBuckets} metric="count" severity />
          </Card>
        </div>
      </Section>
    </div>
  );
}

function Section({
  eyebrow,
  className = "",
  children,
}: {
  eyebrow: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-3 eyebrow">{eyebrow}</div>
      {children}
    </section>
  );
}

function Card({
  title,
  subtitle,
  children,
  flush = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className={flush ? "mb-2" : "mb-3"}>
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-ink-muted">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function QualityStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warning" | "critical";
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      <span
        className="tnum text-[20px] font-semibold tracking-tight"
        style={tone ? { color: `var(--${tone})` } : { color: "var(--ink)" }}
      >
        {value}
      </span>
    </div>
  );
}

// A single stacked bar showing the split of records by disposition.
function QualityBar({
  workable,
  review,
  pending,
}: {
  workable: number;
  review: number;
  pending: number;
}) {
  const total = Math.max(workable + review + pending, 1);
  const segments = [
    { label: "Workable", value: workable, color: "var(--good)" },
    { label: "Needs review", value: review, color: "var(--warning)" },
    { label: "Pending", value: pending, color: "var(--ink-muted)" },
  ];
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        {segments.map((s) => (
          <div
            key={s.label}
            className="h-full"
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.color,
              marginRight: "2px",
            }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-center gap-1.5 text-[12px] text-ink-secondary"
          >
            <span
              className="h-2 w-2 rounded-[3px]"
              style={{ background: s.color }}
            />
            {s.label}
            <span className="tnum font-semibold text-ink">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
