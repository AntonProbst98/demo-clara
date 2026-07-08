// === Cleaning pipeline — the code twin of collections_ingest_webhook_n8n.json ===
//
// This runs the EXACT same stages the n8n workflow runs, in TypeScript, so the
// app can clean a raw CSV locally when the live n8n webhook is unreachable. The
// primary path in /api/ingest calls n8n (Stage 1 → 2 → Route · Channel → 3);
// this module is the deterministic fallback so a demo is never blocked — the
// same anti-fragile pattern used for the Gemini script route.
//
//   raw CSV rows  →  Stage 1 validate & flag  →  Stage 2 policy engine
//                 →  Route · Channel (Internal collections)  →  Stage 3 assemble
//
// Keep this in sync with the jsCode in the n8n nodes and scripts/build-internal-book.mjs.

import type { Account, CleanedData, PortfolioMetadata, Segment } from "./types";

// The channel this tool serves. Other channels are worked elsewhere (external
// agencies / bureau / AI bot) and are routed out of scope.
export const INTERNAL_CHANNEL = "Internal collections";

// Raw export columns, exactly as they arrive from a CRM/Sheet CSV export.
export interface RawRow {
  Company_UUID?: string;
  Segment?: string;
  Credit_Line_USD?: string | number;
  Collections_Channel?: string;
  Amount_Due_USD?: string | number;
  DPD_days?: string | number;
  Billing_Cycle?: string;
  Notes?: string;
  Record_status?: string;
  Data_source?: string;
  [k: string]: unknown;
}

const isMissing = (v: unknown): boolean =>
  v === null || v === undefined || v === "";

// DPD → bucket label (must match DPD_BUCKET_ORDER in metrics.ts exactly).
function dpdBucket(dpd: number | null): string | null {
  if (dpd == null || Number.isNaN(dpd) || dpd <= 0) return null;
  if (dpd <= 30) return "1-30";
  if (dpd <= 60) return "31-60";
  if (dpd <= 90) return "61-90";
  if (dpd <= 180) return "91-180";
  if (dpd <= 365) return "181-365";
  return "365+";
}

// ---- Stage 1 — validation, normalisation & data-quality flagging ----
function validateAndFlag(rows: RawRow[]): Account[] {
  const uuidCounts = new Map<string, number>();
  for (const r of rows) {
    const u = r.Company_UUID;
    if (u) uuidCounts.set(u, (uuidCounts.get(u) ?? 0) + 1);
  }

  return rows.map((r) => {
    const flags: string[] = [];

    const amount = isMissing(r.Amount_Due_USD) ? null : Number(r.Amount_Due_USD);
    const dpd = isMissing(r.DPD_days) ? null : Number(r.DPD_days);
    const credit = isMissing(r.Credit_Line_USD)
      ? null
      : Number(r.Credit_Line_USD);
    const status = (r.Record_status ?? "").toString().trim();

    const amountValid = amount != null && !Number.isNaN(amount) && amount > 0;
    if (amount == null || Number.isNaN(amount)) flags.push("Missing amount");
    else if (amount <= 0) flags.push("Invalid amount (<=0)");

    const dpdValid = dpd != null && !Number.isNaN(dpd) && dpd > 0;
    if (dpd == null || Number.isNaN(dpd)) flags.push("Missing DPD");
    else if (dpd <= 0) flags.push("Invalid DPD (<=0)");

    if (credit == null || Number.isNaN(credit)) flags.push("Missing credit line");
    if (dpdValid && (dpd as number) > 365) flags.push("Aged 365+ days");
    if (status === "Pending_review") flags.push("Pending review");
    if (r.Company_UUID && (uuidCounts.get(r.Company_UUID) ?? 0) > 1) {
      flags.push("Duplicate UUID");
    }

    const workable = amountValid && dpdValid && status === "Active";

    return {
      company_uuid: (r.Company_UUID ?? "").toString(),
      segment: (r.Segment ?? "Regular") as Segment,
      credit_line_usd: (credit ?? null) as number,
      collections_channel: (r.Collections_Channel ?? "").toString(),
      amount_due_usd: (amount ?? null) as number,
      dpd_days: (dpd ?? null) as number,
      dpd_bucket: dpdBucket(dpd) ?? "",
      billing_cycle: (r.Billing_Cycle ?? "").toString(),
      notes: (r.Notes ?? "").toString(),
      record_status: status,
      data_source: (r.Data_source ?? "").toString(),
      workable,
      needs_review: !workable,
      data_quality_flags: flags,
      recommended_policy: null,
      policy_rule_fired: null,
      upfront_required_usd: null,
    } satisfies Account;
  });
}

// ---- Stage 2 — deterministic policy engine ----
// Policy is computed whenever the FINANCIALS are valid (amount > 0 AND dpd > 0),
// independent of `workable`. "Full payment" carries upfront = 0; discounts 50%.
function applyPolicy(accounts: Account[]): Account[] {
  return accounts.map((a) => {
    const amount = Number(a.amount_due_usd);
    const dpd = Number(a.dpd_days);
    const financialsValid =
      a.amount_due_usd != null &&
      !Number.isNaN(amount) &&
      amount > 0 &&
      a.dpd_days != null &&
      !Number.isNaN(dpd) &&
      dpd > 0;

    if (!financialsValid) {
      return {
        ...a,
        recommended_policy: null,
        policy_rule_fired: null,
        upfront_required_usd: null,
      };
    }

    const half = Math.round(amount * 0.5 * 100) / 100;
    let policy: string;
    let rule: string;
    let upfront: number;

    if (dpd <= 30) {
      if (amount < 10000) {
        policy = "Full payment, no discount";
        rule = "DPD 1-30 & Amount < $10k";
        upfront = 0;
      } else if (amount <= 50000) {
        policy = "Full payment, no discount";
        rule = "DPD 1-30 & Amount $10k-$50k";
        upfront = 0;
      } else {
        policy = "20% interest discount if 50% paid upfront";
        rule = "DPD 1-30 & Amount > $50k";
        upfront = half;
      }
    } else {
      policy = "40% interest discount if 50% paid upfront";
      rule = "DPD > 30 (any amount)";
      upfront = half;
    }

    return {
      ...a,
      recommended_policy: policy,
      policy_rule_fired: rule,
      upfront_required_usd: upfront,
    };
  });
}

// ---- Stage 3 — assemble metadata over a set of accounts ----
export function deriveMetadata(accounts: Account[]): PortfolioMetadata {
  const counts = new Map<string, number>();
  for (const a of accounts) {
    counts.set(a.company_uuid, (counts.get(a.company_uuid) ?? 0) + 1);
  }
  const duplicateUuids = [...counts.values()].filter((n) => n > 1).length;

  const exposure = accounts.reduce((sum, a) => {
    const v = Number(a.amount_due_usd);
    return sum + (Number.isNaN(v) || v <= 0 ? 0 : v);
  }, 0);

  return {
    generated_by: "in-app pipeline (n8n fallback)",
    pipeline_version: "1.0.0",
    total_records: accounts.length,
    workable_records: accounts.filter((a) => a.workable).length,
    needs_review_records: accounts.filter((a) => a.needs_review).length,
    pending_review_records: accounts.filter(
      (a) => a.record_status === "Pending_review",
    ).length,
    duplicate_uuids_detected: duplicateUuids,
    total_portfolio_exposure_usd: Math.round(exposure * 100) / 100,
  };
}

/**
 * Full pipeline: raw rows → cleaned → Route · Channel → Internal collections
 * book. Returns exactly the { metadata, accounts } the app consumes, matching
 * the n8n webhook response shape.
 */
export function runInternalPipeline(rows: RawRow[]): CleanedData {
  const cleaned = applyPolicy(validateAndFlag(rows));
  const internal = cleaned.filter(
    (a) => a.collections_channel === INTERNAL_CHANNEL,
  );
  return { metadata: deriveMetadata(internal), accounts: internal };
}

// ---- CSV parsing (RFC-4180-ish: quotes, escaped quotes, CRLF) ----
export function parseCsv(text: string): RawRow[] {
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    rows.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRecord();
    } else if (c === "\r") {
      // swallow; \n handles the record break
    } else {
      field += c;
    }
  }
  // trailing field/record (file may not end in newline)
  if (field !== "" || record.length > 0) pushRecord();

  return matrixToRows(rows);
}

/**
 * Turn a raw cell matrix (row 0 = header) into RawRow objects keyed by column
 * name. Shared by the CSV and XLSX parsers so both produce the identical shape.
 */
export function matrixToRows(matrix: string[][]): RawRow[] {
  if (matrix.length === 0) return [];
  const header = matrix[0].map((h) => (h ?? "").trim());
  const out: RawRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    // skip fully-empty rows
    if (!cells || cells.every((c) => (c ?? "").toString().trim() === "")) {
      continue;
    }
    const obj: RawRow = {};
    header.forEach((key, idx) => {
      if (!key) return;
      const raw = cells[idx];
      obj[key] = raw === undefined || raw === null ? "" : String(raw).trim();
    });
    out.push(obj);
  }
  return out;
}
