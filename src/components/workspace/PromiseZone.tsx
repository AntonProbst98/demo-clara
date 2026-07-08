"use client";

import { useEffect, useState } from "react";
import type { Account } from "@/lib/types";
import { usePromises } from "@/components/providers/PromisesProvider";
import { formatUSDExact, formatDate } from "@/lib/format";
import { promisesToCsv, downloadCsv } from "@/lib/csv";
import { ZoneHeader } from "@/components/workspace/ZoneHeader";

// Local yyyy-mm-dd for today, used to prevent back-dated due dates.
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// The amount the agent should collect, per the pre-computed policy. Prefer the
// upfront figure the pipeline decided; fall back to the full balance.
function prefillAmount(account: Account): string {
  const v = account.upfront_required_usd ?? account.amount_due_usd;
  return v != null ? String(v) : "";
}

export function PromiseZone({ account }: { account: Account }) {
  const { promises, addPromise, removePromise, promisesForAccount } =
    usePromises();
  const accountPromises = promisesForAccount(account.company_uuid);

  // Same gate as the recommendation zone: if the pipeline couldn't compute a
  // policy (bad/missing data) or the account is flagged for review, there's no
  // verified amount to commit against — block logging a promise here too.
  const needsReview = account.needs_review || !account.recommended_policy;

  const today = todayISO();
  const [amount, setAmount] = useState(() => prefillAmount(account));
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  // Auto-dismiss the success confirmation so it doesn't linger onto the next call.
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(null), 5000);
    return () => clearTimeout(t);
  }, [confirm]);

  const parsedAmount = Number(amount);
  // Non-blocking heads-up: promising more than the balance is unusual but allowed.
  const overAmountDue =
    amount.trim() !== "" &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > account.amount_due_usd;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (needsReview) return; // defense in depth — the form isn't rendered anyway
    setConfirm(null);
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) {
      setErr("Enter a promise amount greater than zero.");
      return;
    }
    if (!dueDate) {
      setErr("Choose a due date.");
      return;
    }
    if (dueDate < today) {
      setErr("Due date can't be in the past.");
      return;
    }
    addPromise({
      accountUuid: account.company_uuid,
      amount: parsed,
      dueDate,
      note: note.trim(),
      policyAtLog: account.recommended_policy,
    });
    setErr(null);
    setConfirm(`Promise logged · ${formatUSDExact(parsed)} due ${formatDate(dueDate)}`);
    // Reset for the next commitment, re-seeding the trusted amount.
    setAmount(prefillAmount(account));
    setDueDate("");
    setNote("");
  }

  const committedForAccount = accountPromises.reduce(
    (s, p) => s + p.amount,
    0,
  );

  return (
    <section className="card p-4">
      <ZoneHeader
        index={3}
        title="Log promise to pay"
        trailing={
          <button
            className="btn btn-secondary h-8 px-3 text-[12px]"
            onClick={() =>
              downloadCsv(
                "collections_promises.csv",
                promisesToCsv(promises),
              )
            }
            disabled={promises.length === 0}
            title={
              promises.length === 0
                ? "No promises logged yet"
                : "Export all promises across accounts"
            }
          >
            <DownloadIcon />
            Export all ({promises.length})
          </button>
        }
      />

      {needsReview ? (
        <div className="rounded-[10px] border border-[var(--warning)]/30 bg-[var(--warning-wash)] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-[var(--warning)]">
              <WarnIcon />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-ink">
                Can&apos;t log a promise — account in review
              </p>
              <p className="mt-1 text-[13px] text-ink-secondary">
                No policy was computed for this account, so there is no verified
                amount to commit against. Resolve the data-quality flags before
                recording a promise to pay.
              </p>
            </div>
          </div>
        </div>
      ) : (
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="label" htmlFor="promise-amount">
            Promise amount (USD)
          </label>
          <input
            id="promise-amount"
            className="field mt-1.5 tnum"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-describedby={overAmountDue ? "promise-amount-warn" : undefined}
          />
          {overAmountDue && (
            <p
              id="promise-amount-warn"
              className="mt-1 text-[12px] text-[var(--warning)]"
            >
              Above amount due ({formatUSDExact(account.amount_due_usd)}).
            </p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="promise-date">
            Due date
          </label>
          <input
            id="promise-date"
            type="date"
            className="field mt-1.5 tnum"
            value={dueDate}
            min={today}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn btn-primary w-full sm:w-auto">
            Log promise
          </button>
        </div>
        <div className="sm:col-span-3">
          <label className="label" htmlFor="promise-note">
            Note (optional)
          </label>
          <textarea
            id="promise-note"
            className="field mt-1.5"
            rows={2}
            placeholder="Context for this commitment…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </form>
      )}

      <div role="status" aria-live="polite" className="min-h-[1.25rem]">
        {err && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[var(--critical)]">
            {err}
          </p>
        )}
        {!err && confirm && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-[var(--good)]">
            <CheckIcon />
            {confirm}
          </p>
        )}
      </div>

      {/* Logged promises for this account */}
      <div className="mt-4 border-t border-[var(--line)] pt-3">
        <div className="flex items-center justify-between">
          <span className="eyebrow">
            Promises on this account · {accountPromises.length}
          </span>
          {accountPromises.length > 0 && (
            <span className="tnum text-[12px] font-semibold text-ink">
              {formatUSDExact(committedForAccount)} committed
            </span>
          )}
        </div>

        {accountPromises.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-muted">
            No promises logged for this account yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {accountPromises.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-[8px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5"
              >
                <div className="flex flex-col">
                  <span className="tnum text-[14px] font-semibold text-ink">
                    {formatUSDExact(p.amount)}
                  </span>
                  <span className="text-[12px] text-ink-muted">
                    due {formatDate(p.dueDate)}
                    {p.policyAtLog ? ` · ${p.policyAtLog}` : ""}
                  </span>
                </div>
                {p.note && (
                  <span className="ml-1 flex-1 truncate text-[12px] text-ink-secondary">
                    {p.note}
                  </span>
                )}
                <button
                  className="ml-auto text-ink-muted transition-colors hover:text-[var(--critical)]"
                  onClick={() => removePromise(p.id)}
                  aria-label="Remove promise"
                  title="Remove promise"
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function WarnIcon() {
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
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
