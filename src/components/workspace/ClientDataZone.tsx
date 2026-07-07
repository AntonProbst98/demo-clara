"use client";

import type { Account } from "@/lib/types";
import { dpdTone, segmentTone } from "@/lib/account";
import { formatUSD, formatUSDExact } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { DataField } from "@/components/ui/Field";
import { ZoneHeader } from "@/components/workspace/ZoneHeader";

export function ClientDataZone({ account }: { account: Account }) {
  const tone = dpdTone(account.dpd_days);

  return (
    <section className="card p-5">
      <ZoneHeader index={1} title="Client account" />

      {/* Identity row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="tnum text-[15px] font-semibold tracking-tight text-ink">
          {account.company_uuid}
        </span>
        <Badge tone={segmentTone(account.segment)} dot>
          {account.segment === "FPD" ? "FPD · First-payment default" : "Regular"}
        </Badge>
        {account.workable ? (
          <Badge tone="good">Workable</Badge>
        ) : (
          <Badge tone="warning">Needs review</Badge>
        )}
      </div>

      {/* Amount due — the prominent figure */}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-5 py-4">
        <div>
          <span className="eyebrow">Amount due</span>
          <div className="tnum mt-1 text-[34px] font-semibold leading-none tracking-tight text-ink">
            {formatUSDExact(account.amount_due_usd)}
          </div>
        </div>
        <div className="text-right">
          <span className="eyebrow">Days past due</span>
          <div
            className="tnum mt-1 text-[34px] font-semibold leading-none tracking-tight"
            style={{ color: `var(--${tone})` }}
          >
            {account.dpd_days}
            <span className="ml-1.5 align-middle text-[13px] font-medium text-ink-muted">
              {account.dpd_bucket}
            </span>
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <DataField label="Credit line" mono>
          {formatUSD(account.credit_line_usd)}
        </DataField>
        <DataField label="Billing cycle">
          {account.billing_cycle || "—"}
        </DataField>
        <DataField label="Channel">{account.collections_channel}</DataField>
        <DataField label="Data source">
          <span className="tnum text-[13px] text-ink-secondary">
            {account.data_source}
          </span>
        </DataField>
        <DataField label="Record status">{account.record_status}</DataField>
        <DataField label="Utilization" mono>
          {account.credit_line_usd > 0
            ? `${Math.round(
                (account.amount_due_usd / account.credit_line_usd) * 100,
              )}%`
            : "—"}
        </DataField>
      </div>

      {/* Notes */}
      {account.notes && (
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <span className="eyebrow">Agent notes</span>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
            {account.notes}
          </p>
        </div>
      )}

      {/* Data quality flags */}
      {account.data_quality_flags.length > 0 && (
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <span className="eyebrow">Data quality flags</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {account.data_quality_flags.map((flag) => (
              <span key={flag} className="flag-chip">
                <WarnIcon />
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function WarnIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
