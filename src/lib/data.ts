import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { CleanedData } from "./types";

// Server-side loader. Reads the cleaned dataset from data/cleaned_accounts.json.
// This runs only on the server (never shipped to the client); the file is read
// fresh so replacing the JSON is picked up without touching code.
const DATA_PATH = path.join(process.cwd(), "data", "cleaned_accounts.json");

export async function loadCleanedData(): Promise<CleanedData> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as CleanedData;
    if (!parsed.accounts || !parsed.metadata) {
      throw new Error("Malformed data: expected { metadata, accounts }.");
    }
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Data file not found at ${DATA_PATH}. Place cleaned_accounts.json in the data/ folder (see README).`,
      );
    }
    throw err;
  }
}
