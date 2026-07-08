import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { parseCsv, runInternalPipeline, type RawRow } from "@/lib/pipeline";
import type { CleanedData } from "@/lib/types";

// POST /api/ingest
// Front door for the data flow: an agent uploads a raw collections CSV, this
// route hands it to the LIVE n8n webhook to clean/validate/score/route, then
// persists the returned Internal collections book as the app's data source.
//
//   CSV upload → /api/ingest → n8n webhook (Stage 1→2→Route·Channel→3)
//              → data/internal_accounts.json → Workspace & Daily Progress
//
// If N8N_INGEST_WEBHOOK_URL is unset or the webhook errors/times out, we run the
// identical pipeline in-process (src/lib/pipeline.ts) so a demo is never blocked
// — the same anti-fragile fallback pattern as the Gemini script route.

export const runtime = "nodejs";

const DATA_PATH = path.join(process.cwd(), "data", "internal_accounts.json");

function isCleanedData(v: unknown): v is CleanedData {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as CleanedData).accounts) &&
    !!(v as CleanedData).metadata
  );
}

// Pull the CSV text out of whatever the client sent: multipart file upload,
// a raw text/csv body, or JSON { csv }.
async function readCsv(request: Request): Promise<string> {
  const ctype = request.headers.get("content-type") ?? "";
  if (ctype.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (file && typeof file !== "string") return await file.text();
    const csv = form.get("csv");
    if (typeof csv === "string") return csv;
    return "";
  }
  if (ctype.includes("application/json")) {
    const body = (await request.json()) as { csv?: string };
    return body.csv ?? "";
  }
  return await request.text();
}

// Forward parsed rows to the live n8n webhook and validate the response shape.
async function cleanViaN8n(
  webhookUrl: string,
  rows: RawRow[],
): Promise<CleanedData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) throw new Error(`n8n webhook responded ${res.status}`);
    const data: unknown = await res.json();
    if (!isCleanedData(data)) {
      throw new Error("n8n returned an unexpected shape (expected metadata + accounts).");
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  let csv: string;
  try {
    csv = await readCsv(request);
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }

  const rows = parseCsv(csv);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No rows found. Expected a CSV with a header row and the raw export columns." },
      { status: 400 },
    );
  }

  const webhookUrl = process.env.N8N_INGEST_WEBHOOK_URL;
  let cleaned: CleanedData;
  let source: "n8n" | "local-fallback";
  let reason: string | undefined;

  if (webhookUrl) {
    try {
      cleaned = await cleanViaN8n(webhookUrl, rows);
      source = "n8n";
    } catch (err) {
      cleaned = runInternalPipeline(rows);
      source = "local-fallback";
      reason = err instanceof Error ? err.message : "n8n webhook failed";
    }
  } else {
    cleaned = runInternalPipeline(rows);
    source = "local-fallback";
    reason = "N8N_INGEST_WEBHOOK_URL not set";
  }

  try {
    await writeFile(DATA_PATH, JSON.stringify(cleaned, null, 2) + "\n", "utf-8");
  } catch (err) {
    return NextResponse.json(
      {
        error: "Cleaned the data but could not persist it.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    source,
    reason,
    rowsReceived: rows.length,
    metadata: cleaned.metadata,
  });
}
