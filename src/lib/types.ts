// Shape of the cleaned data produced upstream by the n8n pipeline.
// The app CONSUMES these fields; it never re-derives policy or arithmetic.

export type Segment = "Regular" | "FPD";

export interface Account {
  company_uuid: string;
  segment: Segment;
  credit_line_usd: number;
  collections_channel: string;
  amount_due_usd: number;
  dpd_days: number;
  dpd_bucket: string;
  billing_cycle: string;
  notes: string;
  record_status: string;
  data_source: string;
  workable: boolean;
  needs_review: boolean;
  data_quality_flags: string[];
  recommended_policy: string | null;
  policy_rule_fired: string | null;
  upfront_required_usd: number | null;
}

export interface PortfolioMetadata {
  total_records: number;
  workable_records: number;
  needs_review_records: number;
  pending_review_records: number;
  duplicate_uuids_detected: number;
  total_portfolio_exposure_usd: number;
  // Optional provenance fields tolerated but not required.
  generated_by?: string;
  pipeline_version?: string;
}

export interface CleanedData {
  metadata: PortfolioMetadata;
  accounts: Account[];
}

// A promise-to-pay logged by an agent. Lives in client React state only (demo).
export interface Promise {
  id: string;
  accountUuid: string;
  amount: number;
  dueDate: string; // ISO yyyy-mm-dd
  note: string;
  policyAtLog: string | null; // policy in effect when the promise was made
  loggedAt: string; // ISO timestamp
}
