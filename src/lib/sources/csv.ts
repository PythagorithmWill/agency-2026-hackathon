/**
 * Small, dependency-free streaming CSV parser (RFC 4180 plus the usual
 * real-world tolerances) used by the scripts/ingest loaders.
 *
 * Why not csv-parse: it is not in node_modules and PROJECT rules say don't
 * add dependencies without a reason. The sources we ingest are large (the
 * Elections Canada file is 2.2 GB) so the parser must be incremental: feed
 * it chunks from a ReadStream, it emits complete records, and it keeps only
 * the partial record across chunk boundaries.
 *
 * Tolerances:
 *   - UTF-8 BOM on the first chunk is stripped.
 *   - CRLF, LF and bare CR line endings.
 *   - Quoted fields may contain the delimiter, newlines and doubled quotes.
 *   - A quote appearing mid-field (not at field start) is kept literally,
 *     which is how Excel-produced files behave.
 *   - Blank lines are skipped.
 */
export class CsvParser {
  private field = "";
  private record: string[] = [];
  private inQuotes = false;
  private afterClosingQuote = false;
  private atFieldStart = true;
  private lastWasCr = false;
  private first = true;
  readonly delimiter: string;

  constructor(opts: { delimiter?: string } = {}) {
    this.delimiter = opts.delimiter ?? ",";
  }

  /** Feed a chunk of text; returns every complete record found so far. */
  push(chunk: string): string[][] {
    if (this.first) {
      this.first = false;
      if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1);
    }
    const out: string[][] = [];
    const d = this.delimiter;
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (this.inQuotes) {
        if (c === '"') {
          if (chunk[i + 1] === '"') {
            this.field += '"';
            i++;
          } else if (i + 1 === chunk.length) {
            // Quote at the very end of a chunk: could be an escaped pair
            // split across chunks. Mark and decide on the next push.
            this.inQuotes = false;
            this.afterClosingQuote = true;
            this.pendingQuoteAtBoundary = true;
          } else {
            this.inQuotes = false;
            this.afterClosingQuote = true;
          }
        } else {
          this.field += c;
        }
        continue;
      }
      if (this.pendingQuoteAtBoundary) {
        this.pendingQuoteAtBoundary = false;
        if (c === '"') {
          // It was an escaped quote split across the boundary.
          this.field += '"';
          this.inQuotes = true;
          this.afterClosingQuote = false;
          continue;
        }
      }
      if (c === '"' && this.atFieldStart) {
        this.inQuotes = true;
        this.atFieldStart = false;
        continue;
      }
      if (c === d) {
        this.endField();
        continue;
      }
      if (c === "\r") {
        this.endField();
        this.endRecord(out);
        this.lastWasCr = true;
        continue;
      }
      if (c === "\n") {
        if (this.lastWasCr) {
          this.lastWasCr = false;
          continue;
        }
        this.endField();
        this.endRecord(out);
        continue;
      }
      this.lastWasCr = false;
      this.atFieldStart = false;
      this.afterClosingQuote = false;
      this.field += c;
    }
    return out;
  }

  private pendingQuoteAtBoundary = false;

  /** Flush the final record (call once at EOF). */
  end(): string[][] {
    const out: string[][] = [];
    if (this.field.length > 0 || this.record.length > 0 || this.afterClosingQuote) {
      this.endField();
      this.endRecord(out);
    }
    return out;
  }

  private endField(): void {
    this.record.push(this.field);
    this.field = "";
    this.atFieldStart = true;
    this.afterClosingQuote = false;
    this.lastWasCr = false;
  }

  private endRecord(out: string[][]): void {
    const rec = this.record;
    this.record = [];
    this.atFieldStart = true;
    // Skip blank lines (single empty field).
    if (rec.length === 1 && rec[0] === "") return;
    out.push(rec);
  }
}

/** Parse a whole string (tests, small files). */
export function parseCsv(text: string, opts: { delimiter?: string } = {}): string[][] {
  const p = new CsvParser(opts);
  return [...p.push(text), ...p.end()];
}

/** Turn a header row + record into an object; extra/missing cells tolerated. */
export function rowToObject(header: readonly string[], record: readonly string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i < header.length; i++) o[header[i]] = record[i] ?? "";
  return o;
}
