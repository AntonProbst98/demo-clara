"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [showHelp, setShowHelp] = useState(false);
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
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById("workspace-main")
      ?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  // Keyboard accelerators for the all-day queue loop. Refs keep `go` and the
  // dialog state current so the listener subscribes once. `g`/`c` reach the
  // recommendation zone via window events; typing in a field suppresses the
  // letter shortcuts, and an open dialog suppresses everything but `?`.
  const goRef = useRef(go);
  goRef.current = go;
  const showHelpRef = useRef(showHelp);
  showHelpRef.current = showHelp;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);

      if (e.key === "Escape") {
        setShowHelp(false);
        if (typing) t?.blur();
        return;
      }
      if (e.key === "/" && !typing) {
        e.preventDefault();
        document.getElementById("queue-search")?.focus();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }
      // With the help dialog open, don't fire the loop shortcuts underneath it.
      if (showHelpRef.current) return;

      switch (e.key.toLowerCase()) {
        case "j":
          e.preventDefault();
          goRef.current(1);
          break;
        case "k":
          e.preventDefault();
          goRef.current(-1);
          break;
        case "g":
          e.preventDefault();
          window.dispatchEvent(new Event("ws:generate"));
          break;
        case "c":
          e.preventDefault();
          window.dispatchEvent(new Event("ws:copy"));
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          <div className="mx-auto grid max-w-6xl gap-3 p-5 pb-8 lg:grid-cols-2 lg:items-start">
            {/* Two-column workspace: context (zone 1) spans the top, then the two
                action zones sit side by side so an agent sees all sections in one
                screen without scrolling (PRODUCT.md: everything on one screen). It
                collapses to a single stacked column below lg. */}
            <div className="lg:col-span-2">
              <ClientDataZone account={selected} />
            </div>
            {/* Distinct key prefixes: both zones remount on account change, but
                sibling keys must be unique or React drops one of them. */}
            <RecommendationZone key={`rec-${keyOf(selected)}`} account={selected} />
            <PromiseZone key={`promise-${keyOf(selected)}`} account={selected} />

            {/* Zone 4 — navigation */}
            <nav className="card flex items-center justify-between gap-3 p-3 lg:col-span-2">
              <button
                className="btn btn-secondary"
                onClick={() => go(-1)}
                disabled={effectiveIndex <= 0}
              >
                <ArrowLeft />
                Previous
                <kbd className="kbd ml-1">K</kbd>
              </button>
              <div className="flex items-center gap-2.5">
                <span className="tnum text-[12px] text-ink-muted">
                  {filtered.length ? effectiveIndex + 1 : 0} of {filtered.length}
                  <span className="mx-1.5 text-[var(--line-strong)]">·</span>
                  {metadata.total_records} in your book
                </span>
                <button
                  className="focusable flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] text-ink-muted transition-colors hover:bg-[var(--surface-2)] hover:text-ink-secondary"
                  onClick={() => setShowHelp(true)}
                  title="Keyboard shortcuts"
                >
                  <kbd className="kbd">?</kbd>
                  Shortcuts
                </button>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => go(1)}
                disabled={effectiveIndex >= filtered.length - 1}
              >
                <kbd className="kbd mr-1">J</kbd>
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

      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["J"], label: "Next account" },
  { keys: ["K"], label: "Previous account" },
  { keys: ["/"], label: "Focus search" },
  { keys: ["G"], label: "Generate script" },
  { keys: ["C"], label: "Copy script" },
  { keys: ["?"], label: "Toggle this help" },
  { keys: ["Esc"], label: "Close · clear focus" },
];

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog on open and hand it back to the trigger on close.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prev?.focus?.();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <button
        className="dialog-scrim absolute inset-0 bg-[var(--scrim)]"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="dialog-panel card relative w-full max-w-sm p-5">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Keyboard shortcuts</span>
          <button
            ref={closeRef}
            className="focusable rounded-[6px] p-1 text-ink-muted transition-colors hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
        <ul className="mt-4 space-y-2.5">
          {SHORTCUTS.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between gap-4 text-[13px] text-ink-secondary"
            >
              <span>{s.label}</span>
              <span className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="kbd">
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
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
