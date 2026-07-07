import type { Promise as PromiseToPay } from "./types";

// Minimal, dependency-free CSV. Quotes fields and escapes embedded quotes so
// notes with commas/quotes/newlines round-trip cleanly into Excel/Sheets.
function cell(value: string | number): string {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export function promisesToCsv(promises: PromiseToPay[]): string {
  const header = [
    "promise_id",
    "company_uuid",
    "promise_amount_usd",
    "due_date",
    "policy",
    "logged_at",
    "note",
  ];
  const rows = promises.map((p) =>
    [
      p.id,
      p.accountUuid,
      p.amount.toFixed(2),
      p.dueDate,
      p.policyAtLog ?? "",
      p.loggedAt,
      p.note,
    ]
      .map(cell)
      .join(","),
  );
  return [header.map(cell).join(","), ...rows].join("\r\n");
}

/** Trigger a client-side download of a CSV string. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
