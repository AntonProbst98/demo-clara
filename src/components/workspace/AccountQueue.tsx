"use client";

import { useMemo } from "react";
import type { Account } from "@/lib/types";
import {
  type QueueFilters,
  type StatusFilter,
  facetCounts,
} from "@/lib/filter";
import { DPD_BUCKET_ORDER } from "@/lib/metrics";
import { dpdTone, segmentTone } from "@/lib/account";
import { formatUSDExact } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";

interface Props {
  accounts: Account[];
  filtered: Account[];
  filters: QueueFilters;
  onFiltersChange: (f: QueueFilters) => void;
  selectedUuid: string | null;
  onSelect: (a: Account) => void;
  contactedUuids: Set<string>;
}

export function AccountQueue({
  accounts,
  filtered,
  filters,
  onFiltersChange,
  selectedUuid,
  onSelect,
  contactedUuids,
}: Props) {
  const channelCounts = useMemo(
    () => facetCounts(accounts, "collections_channel"),
    [accounts],
  );
  const segmentCounts = useMemo(
    () => facetCounts(accounts, "segment"),
    [accounts],
  );
  const bucketCounts = useMemo(
    () => facetCounts(accounts, "dpd_bucket"),
    [accounts],
  );

  const workableCount = useMemo(
    () => accounts.filter((a) => a.workable).length,
    [accounts],
  );
  const reviewCount = accounts.length - workableCount;

  function toggle(list: string[], value: string): string[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  const channels = [...channelCounts.keys()].sort();
  const buckets = DPD_BUCKET_ORDER.filter((b) => bucketCounts.has(b));

  return (
    <aside className="flex h-full w-full flex-col border-r border-[var(--line)] bg-[var(--surface)]">
      {/* Search + filters */}
      <div className="shrink-0 space-y-3 border-b border-[var(--line)] p-4">
        <div className="relative">
          <SearchIcon />
          <input
            id="queue-search"
            aria-label="Search accounts by UUID, channel, or policy"
            className="field pl-9 pr-9"
            placeholder="Search UUID, channel, policy…"
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
          />
          <kbd className="kbd pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
            /
          </kbd>
        </div>

        <FacetGroup label="Status">
          <StatusChip
            active={filters.status === "all"}
            onClick={() => onFiltersChange({ ...filters, status: "all" })}
            count={accounts.length}
          >
            All
          </StatusChip>
          <StatusChip
            active={filters.status === "workable"}
            onClick={() =>
              setStatus(filters, onFiltersChange, "workable")
            }
            count={workableCount}
            tone="good"
          >
            Workable
          </StatusChip>
          <StatusChip
            active={filters.status === "needs_review"}
            onClick={() =>
              setStatus(filters, onFiltersChange, "needs_review")
            }
            count={reviewCount}
            tone="warning"
          >
            Needs review
          </StatusChip>
        </FacetGroup>

        <FacetGroup label="Segment">
          {["Regular", "FPD"].map((s) => (
            <Chip
              key={s}
              active={filters.segments.includes(s)}
              count={segmentCounts.get(s) ?? 0}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  segments: toggle(filters.segments, s),
                })
              }
            >
              {s}
            </Chip>
          ))}
        </FacetGroup>

        <FacetGroup label="Channel">
          {channels.map((c) => (
            <Chip
              key={c}
              active={filters.channels.includes(c)}
              count={channelCounts.get(c) ?? 0}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  channels: toggle(filters.channels, c),
                })
              }
            >
              {c}
            </Chip>
          ))}
        </FacetGroup>

        <FacetGroup label="DPD bucket">
          {buckets.map((b) => (
            <Chip
              key={b}
              active={filters.buckets.includes(b)}
              count={bucketCounts.get(b) ?? 0}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  buckets: toggle(filters.buckets, b),
                })
              }
            >
              {b}
            </Chip>
          ))}
        </FacetGroup>
      </div>

      {/* Result count */}
      <div className="flex shrink-0 items-center justify-between px-4 py-2.5">
        <span className="eyebrow">
          Queue · {filtered.length} of {accounts.length}
        </span>
        {isFiltered(filters) && (
          <button
            className="text-[12px] font-medium text-accent hover:underline"
            onClick={() =>
              onFiltersChange({
                search: "",
                channels: [],
                segments: [],
                buckets: [],
                status: "all",
              })
            }
          >
            Clear
          </button>
        )}
      </div>

      {/* List */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-[13px] text-ink-muted">
            No accounts match these filters.
          </p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((a) => (
              <QueueRow
                key={`${a.company_uuid}__${a.dpd_days}`}
                account={a}
                selected={a.company_uuid === selectedUuid}
                contacted={contactedUuids.has(a.company_uuid)}
                onSelect={() => onSelect(a)}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function setStatus(
  filters: QueueFilters,
  onChange: (f: QueueFilters) => void,
  status: StatusFilter,
) {
  onChange({ ...filters, status: filters.status === status ? "all" : status });
}

function isFiltered(f: QueueFilters): boolean {
  return (
    f.search !== "" ||
    f.channels.length > 0 ||
    f.segments.length > 0 ||
    f.buckets.length > 0 ||
    f.status !== "all"
  );
}

function QueueRow({
  account,
  selected,
  contacted,
  onSelect,
}: {
  account: Account;
  selected: boolean;
  contacted: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={`focusable w-full rounded-[8px] border px-3 py-2.5 text-left transition-colors ${
          selected
            ? "border-[var(--accent)] bg-[var(--accent-wash)]"
            : "border-transparent hover:bg-[var(--surface-2)]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="tnum truncate text-[12px] font-medium text-ink-secondary">
            {account.company_uuid}
          </span>
          <Badge tone={segmentTone(account.segment)}>{account.segment}</Badge>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="tnum text-[15px] font-semibold text-ink">
            {formatUSDExact(account.amount_due_usd)}
          </span>
          <span
            className="tnum text-[12px] font-semibold"
            style={{ color: `var(--${dpdTone(account.dpd_days)})` }}
          >
            {account.dpd_days} DPD
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[12px] text-ink-muted">
            {account.collections_channel}
          </span>
          {contacted && (
            <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-[var(--good)]">
              <CheckIcon /> Contacted
            </span>
          )}
          {account.needs_review && !contacted && (
            <span className="ml-auto text-[12px] font-medium text-[var(--warning)]">
              Review
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

function FacetGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="eyebrow">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-1 text-[12px] font-medium transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-wash)] text-accent"
          : "border-[var(--line-strong)] text-ink-secondary hover:bg-[var(--surface-2)]"
      }`}
    >
      {children}
      <span
        className={`tnum text-[12px] ${active ? "text-accent" : "text-ink-muted"}`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusChip({
  active,
  count,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  tone?: "good" | "warning";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-1 text-[12px] font-medium transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-wash)] text-accent"
          : "border-[var(--line-strong)] text-ink-secondary hover:bg-[var(--surface-2)]"
      }`}
    >
      {tone && !active && (
        <span
          className="dot h-1.5 w-1.5 rounded-full"
          style={{ background: `var(--${tone})` }}
        />
      )}
      {children}
      <span
        className={`tnum text-[12px] ${active ? "text-accent" : "text-ink-muted"}`}
      >
        {count}
      </span>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
