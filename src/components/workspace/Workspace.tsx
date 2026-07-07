"use client";

import { useMemo, useState } from "react";
import type { Account, PortfolioMetadata } from "@/lib/types";
import { applyFilters, EMPTY_FILTERS, type QueueFilters } from "@/lib/filter";
import { usePromises } from "@/components/providers/PromisesProvider";
import { AccountQueue } from "@/components/workspace/AccountQueue";
import { ClientDataZone } from "@/components/workspace/ClientDataZone";
import { RecommendationZone } from "@/components/workspace/RecommendationZone";
import { PromiseZone } from "@/components/workspace/PromiseZone";

const keyOf = (a: Account) => `${a.company_uuid}__${a.dpd_days}`;

export function Workspace({
  accounts,
  metadata,
}: {
  accounts: Account[];
  metadata: PortfolioMetadata;
}) {
  const [filters, setFilters] = useState<QueueFilters>(EMPTY_FILTERS);
  const [selectedKey, setSelectedKey] = useState<string>(() =>
    accounts.length ? keyOf(accounts[0]) : "",
  );
  const { promises } = usePromises();

  const filtered = useMemo(
    () => applyFilters(accounts, filters),
    [accounts, filters],
  );

  const contactedUuids = useMemo(
    () => new Set(promises.map((p) => p.accountUuid)),
    [promises],
  );

  // Resolve the selected account against the current filtered list. If the
  // selection dropped out of the filter, fall back to the first visible row.
  const selectedIndex = filtered.findIndex((a) => keyOf(a) === selectedKey);
  const effectiveIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selected: Account | undefined =
    filtered[effectiveIndex] ?? accounts[0];

  function select(a: Account) {
    setSelectedKey(keyOf(a));
  }

  function go(delta: number) {
    if (!filtered.length) return;
    const next = Math.min(
      Math.max(effectiveIndex + delta, 0),
      filtered.length - 1,
    );
    setSelectedKey(keyOf(filtered[next]));
    // Bring the top of the panel back into view on navigation.
    document
      .getElementById("workspace-main")
      ?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 md:grid-cols-[340px_1fr]">
      <div className="hidden min-h-0 md:block">
        <AccountQueue
          accounts={accounts}
          filtered={filtered}
          filters={filters}
          onFiltersChange={setFilters}
          selectedUuid={selected?.company_uuid ?? null}
          onSelect={select}
          contactedUuids={contactedUuids}
        />
      </div>

      <div
        id="workspace-main"
        className="scroll-thin min-h-0 overflow-y-auto bg-[var(--plane)]"
      >
        {selected ? (
          <div className="mx-auto max-w-3xl space-y-4 p-5 pb-16">
            <ClientDataZone account={selected} />
            <RecommendationZone key={keyOf(selected)} account={selected} />
            <PromiseZone account={selected} />

            {/* Zone 4 — navigation */}
            <nav className="card flex items-center justify-between gap-3 p-3">
              <button
                className="btn btn-secondary"
                onClick={() => go(-1)}
                disabled={effectiveIndex <= 0}
              >
                <ArrowLeft />
                Previous
              </button>
              <span className="tnum text-[12px] text-ink-muted">
                {filtered.length ? effectiveIndex + 1 : 0} of {filtered.length}
                <span className="mx-1.5 text-[var(--line-strong)]">·</span>
                {metadata.total_records} in portfolio
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => go(1)}
                disabled={effectiveIndex >= filtered.length - 1}
              >
                Next
                <ArrowRight />
              </button>
            </nav>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-[14px] text-ink-muted">
            No account selected.
          </div>
        )}
      </div>
    </div>
  );
}

function ArrowLeft() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
