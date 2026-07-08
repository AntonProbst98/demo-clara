"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { PortfolioMetadata } from "@/lib/types";
import { formatNumber, formatUSD } from "@/lib/format";

const RAW_COLUMNS = [
  "Company_UUID",
  "Segment",
  "Credit_Line_USD",
  "Collections_Channel",
  "Amount_Due_USD",
  "DPD_days",
  "Billing_Cycle",
  "Notes",
  "Record_status",
  "Data_source",
];

interface IngestResult {
  ok: boolean;
  source: "n8n" | "local-fallback";
  reason?: string;
  rowsReceived: number;
  metadata: PortfolioMetadata;
}

type Status = "idle" | "uploading" | "done" | "error";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    if (!f) return;
    setFile(f);
    setStatus("idle");
    setResult(null);
    setError(null);
  }

  async function ingest() {
    if (!file) return;
    setStatus("uploading");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Ingest failed.");
      }
      setResult(data as IngestResult);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingest failed.");
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <div className="eyebrow">Ingest</div>
        <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-ink">
          Import collections export
        </h1>
        <p className="mt-1 text-[13px] text-ink-secondary">
          Drop a raw CSV or Excel (.xlsx) export. It&apos;s cleaned, validated,
          policy-scored and routed to the Internal collections book by the live
          n8n pipeline, then loaded into the workspace.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`card flex flex-col items-center justify-center gap-3 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-[var(--accent)] bg-[var(--accent-wash)]" : ""
        }`}
      >
        <UploadIcon />
        <div>
          <p className="text-[14px] font-medium text-ink">
            {file ? file.name : "Drag a .csv or .xlsx here, or"}{" "}
            {!file && (
              <button
                className="text-accent hover:underline"
                onClick={() => inputRef.current?.click()}
              >
                browse
              </button>
            )}
          </p>
          {file && (
            <p className="tnum mt-0.5 text-[12px] text-ink-muted">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <div className="mt-1 flex items-center gap-2">
          <button
            className="btn btn-primary"
            disabled={!file || status === "uploading"}
            onClick={ingest}
          >
            {status === "uploading" ? "Cleaning…" : "Clean & load"}
          </button>
          {file && (
            <button
              className="btn btn-secondary"
              onClick={() => inputRef.current?.click()}
            >
              Choose another
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card mt-4 border-[color-mix(in_srgb,var(--critical)_40%,transparent)] p-4">
          <div className="eyebrow" style={{ color: "var(--critical)" }}>
            Error
          </div>
          <p className="mt-1 text-[13px] text-ink-secondary">{error}</p>
        </div>
      )}

      {result && (
        <div className="card mt-4 p-5">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Loaded</div>
            <span
              className="badge"
              data-tone={result.source === "n8n" ? "good" : "warning"}
            >
              <span className="dot" />
              {result.source === "n8n"
                ? "Cleaned by n8n (live)"
                : "Cleaned by local fallback"}
            </span>
          </div>

          {result.source === "local-fallback" && result.reason && (
            <p className="mt-2 text-[12px] text-ink-muted">
              n8n webhook not reached ({result.reason}) — ran the identical
              in-app pipeline so nothing is blocked.
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Stat label="Rows received" value={formatNumber(result.rowsReceived)} />
            <Stat
              label="Internal book"
              value={formatNumber(result.metadata.total_records)}
            />
            <Stat
              label="Workable"
              value={formatNumber(result.metadata.workable_records)}
              tone="good"
            />
            <Stat
              label="Needs review"
              value={formatNumber(result.metadata.needs_review_records)}
              tone="warning"
            />
            <Stat
              label="Duplicate UUIDs"
              value={formatNumber(result.metadata.duplicate_uuids_detected)}
              tone={
                result.metadata.duplicate_uuids_detected > 0 ? "critical" : undefined
              }
            />
            <Stat
              label="Exposure"
              value={formatUSD(result.metadata.total_portfolio_exposure_usd)}
            />
          </div>

          <div className="mt-5 flex items-center gap-2 border-t border-[var(--line)] pt-4">
            <Link href="/workspace" className="btn btn-primary">
              Open workspace
            </Link>
            <Link href="/dashboard" className="btn btn-secondary">
              Daily progress
            </Link>
          </div>
        </div>
      )}

      {/* Expected columns hint */}
      <div className="mt-6">
        <div className="eyebrow">Expected columns</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {RAW_COLUMNS.map((c) => (
            <span
              key={c}
              className="tnum rounded-[5px] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 text-[11.5px] text-ink-secondary"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({
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
        style={{ color: tone ? `var(--${tone})` : "var(--ink)" }}
      >
        {value}
      </span>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ink-muted)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}
