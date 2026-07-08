import { NextResponse } from "next/server";
import { writeFile, mkdir, rename } from "fs/promises";
import path from "path";
import { parseCsv, runInternalPipeline, type RawRow } from "@/lib/pipeline";
import { parseXlsx } from "@/lib/xlsx";
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

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_PATH = path.join(DATA_DIR, "internal_accounts.json");

function isCleanedData(v: unknown): v is CleanedData {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as CleanedData).accounts) &&
    !!(v as CleanedData).metadata
  );
}

function looksXlsx(name: string, type: string): boolean {
  const n = name.toLowerCase();
  return (
    n.endsWith(".xlsx") ||
    n.endsWith(".xlsm") ||
    type.includes("spreadsheetml") // openxmlformats…spreadsheetml.sheet
  );
}

// Turn whatever the client sent into raw rows. Handles an Excel (.xlsx) or CSV
// file upload, a raw text/csv body, or JSON { csv }. The file FORMAT is parsed
// here; the actual cleaning still happens downstream (n8n, or the fallback).
async function readRows(request: Request): Promise<RawRow[]> {
  const ctype = request.headers.get("content-type") ?? "";
  if (ctype.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (file && typeof file !== "string") {
      if (looksXlsx(file.name ?? "", file.type ?? "")) {
        return parseXlsx(Buffer.from(await file.arrayBuffer()));
      }
      return parseCsv(await file.text());
    }
    const csv = form.get("csv");
    return typeof csv === "string" ? parseCsv(csv) : [];
  }
  if (ctype.includes("application/json")) {
    const body = (await request.json()) as { csv?: string };
    return parseCsv(body.csv ?? "");
  }
  return parseCsv(await request.text());
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
  let rows: RawRow[];
  try {
    rows = await readRows(request);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read the upload." },
      { status: 400 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No rows found. Expected a CSV or .xlsx with a header row and the raw export columns." },
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

  // Atomic write: ensure the dir exists, write a temp file, then rename over the
  // target so a reader never sees a half-written file. The detailed error (code
  // + resolved path) is surfaced so a persist failure is diagnosable, not opaque.
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DATA_PATH}.tmp`;
    await writeFile(tmp, JSON.stringify(cleaned, null, 2) + "\n", "utf-8");
    await rename(tmp, DATA_PATH);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    return NextResponse.json(
      {
        error: "Cleaned the data but could not persist it.",
        detail: `${e.code ? e.code + ": " : ""}${e.message ?? String(err)}`,
        path: DATA_PATH,
        source,
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
