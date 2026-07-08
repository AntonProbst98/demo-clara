import "server-only";
import { inflateRawSync } from "zlib";
import { matrixToRows, type RawRow } from "./pipeline";

// === Minimal .xlsx reader — zero dependencies ===
//
// An .xlsx file is a ZIP archive of XML parts. We only need two: the shared
// string table and the first worksheet. We parse the ZIP central directory,
// inflate those two entries with Node's zlib, and read the cell values — enough
// to turn an Excel export into the same raw row objects the CSV parser produces.
// Runs server-side only (uses zlib + Buffer), inside the /api/ingest route.

interface ZipEntry {
  method: number;
  compSize: number;
  localOffset: number;
}

function readCentralDirectory(buf: Buffer): Map<string, ZipEntry> {
  const entries = new Map<string, ZipEntry>();

  // Locate the End Of Central Directory record (signature 0x06054b50).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a valid .xlsx file (no ZIP directory).");

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // start of central directory

  for (let e = 0; e < count; e++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break; // central dir header
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    entries.set(name, { method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function extractText(buf: Buffer, entry: ZipEntry): string {
  const lo = entry.localOffset;
  // Local file header: name/extra lengths live at +26/+28; data follows.
  const nameLen = buf.readUInt16LE(lo + 26);
  const extraLen = buf.readUInt16LE(lo + 28);
  const start = lo + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + entry.compSize);
  if (entry.method === 0) return data.toString("utf8"); // stored
  if (entry.method === 8) return inflateRawSync(data).toString("utf8"); // deflate
  throw new Error(`Unsupported ZIP compression method ${entry.method}.`);
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&"); // last, so decoded text isn't re-decoded
}

// Column letters ("A", "AB") → zero-based index.
function colToIndex(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n - 1;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t: RegExpExecArray | null;
    let s = "";
    while ((t = tRe.exec(m[1]))) s += decodeXml(t[1]);
    out.push(s);
  }
  return out;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const matrix: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml))) {
    const cells: string[] = [];
    const cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cRe.exec(rm[1]))) {
      const attrs = cm[1] ?? "";
      const body = cm[2]; // undefined when the cell is self-closing (empty)
      const refM = /r="([A-Z]+)\d+"/.exec(attrs);
      const col = refM ? colToIndex(refM[1]) : cells.length;
      const typeM = /t="([^"]+)"/.exec(attrs);
      const type = typeM ? typeM[1] : "";

      let val = "";
      if (body != null) {
        if (type === "s") {
          const vM = /<v>([\s\S]*?)<\/v>/.exec(body);
          const idx = vM ? parseInt(vM[1], 10) : NaN;
          val = Number.isNaN(idx) ? "" : shared[idx] ?? "";
        } else if (type === "inlineStr") {
          const tM = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(body);
          val = tM ? decodeXml(tM[1]) : "";
        } else {
          const vM = /<v>([\s\S]*?)<\/v>/.exec(body);
          val = vM ? decodeXml(vM[1]) : "";
        }
      }
      cells[col] = val;
    }
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] === undefined) cells[i] = "";
    }
    matrix.push(cells);
  }
  return matrix;
}

/** Parse the first worksheet of an .xlsx buffer into raw row objects. */
export function parseXlsx(buf: Buffer): RawRow[] {
  const entries = readCentralDirectory(buf);

  const sharedEntry = entries.get("xl/sharedStrings.xml");
  const shared = sharedEntry
    ? parseSharedStrings(extractText(buf, sharedEntry))
    : [];

  const sheetName = [...entries.keys()]
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    })[0];
  if (!sheetName) throw new Error("No worksheet found in the .xlsx file.");

  const matrix = parseSheet(extractText(buf, entries.get(sheetName)!), shared);
  return matrixToRows(matrix);
}
