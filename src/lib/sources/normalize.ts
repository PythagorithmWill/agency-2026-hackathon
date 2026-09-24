/**
 * Pure normalisation helpers shared by the scripts/ingest loaders and the
 * src/lib/sources query helpers. Everything here is deterministic and
 * unit-tested; no I/O.
 */

/** Uppercase, trim, collapse whitespace — the same shape as the DB index `upper(trim(name))`. */
export function normName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * Loose vendor/entity key for matching across sources: normName plus
 * removal of punctuation and common corporate suffixes. Do NOT use as a
 * storage key; use it for fuzzy joins where "ACME INC." and "Acme, Inc"
 * should meet.
 */
const SUFFIXES =
  /\b(INC|INCORPORATED|LTD|LTEE|LIMITED|LIMITEE|CORP|CORPORATION|CO|COMPANY|LLC|LLP|LP|PLC|ULC|SENC|SENCRL|SA|SARL|GMBH|AG|NV|BV|THE)\b\.?/g;
export function nameKey(raw: string | null | undefined): string {
  let s = normName(raw);
  if (!s) return "";
  s = s.replace(/[.,'"()&/\\-]+/g, " ");
  s = s.replace(SUFFIXES, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** Canadian postal code → "A1A1A1" (no space, upper) or "" when it does not look like one. */
export function normPostal(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(s) ? s : "";
}

/** First three characters of a normalised postal code (forward sortation area). */
export function fsaOf(raw: string | null | undefined): string {
  const p = normPostal(raw);
  return p ? p.slice(0, 3) : "";
}

/**
 * Money/decimal parsing tolerant of "$1,234.56", "  .00", "(123.45)" (negative),
 * "1 234,56" (French thousands/decimal), blanks and junk → null.
 */
export function parseMoney(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$\s]/g, "");
  if (s.startsWith("-")) {
    neg = !neg;
    s = s.slice(1);
  }
  // French style "1234,56" (comma as decimal, no dot) → dot.
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  s = s.replace(/,/g, "");
  if (s.startsWith(".")) s = "0" + s;
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

export function parseIntLoose(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Date parsing → ISO "YYYY-MM-DD" or null. Accepts YYYY-MM-DD, YYYY/MM/DD,
 * YYYYMMDD, and DD/MM/YYYY (Elections Canada older returns). Rejects
 * impossible dates and years outside 1900–2100.
 */
export function parseDateLoose(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let mm: RegExpMatchArray | null;
  if ((mm = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/))) {
    y = +mm[1]; m = +mm[2]; d = +mm[3];
  } else if ((mm = s.match(/^(\d{4})(\d{2})(\d{2})$/))) {
    y = +mm[1]; m = +mm[2]; d = +mm[3];
  } else if ((mm = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) {
    d = +mm[1]; m = +mm[2]; y = +mm[3];
  } else {
    return null;
  }
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Government of Canada fiscal year label ("2023-2024") for an ISO date; FY runs Apr 1 – Mar 31. */
export function fiscalYearOf(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const m = isoDate.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const y = +m[1];
  const month = +m[2];
  const start = month >= 4 ? y : y - 1;
  return `${start}-${start + 1}`;
}

/** Validate/normalise a fiscal-year label; accepts "2023-2024", "2023-24", "2023" → "2023-2024". */
export function normFiscalYear(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{4})$/);
  if (m && +m[2] === +m[1] + 1) return s;
  m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const y = +m[1];
    if (+m[2] === (y + 1) % 100) return `${y}-${y + 1}`;
  }
  m = s.match(/^(\d{4})$/);
  if (m) return `${+m[1]}-${+m[1] + 1}`;
  return null;
}

/** Canadian Business Number: 9 digits (program account suffix dropped) or "". */
export function normBn(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = s.match(/^(\d{9})(?:[A-Z]{2}\d{4})?$/);
  return m ? m[1] : "";
}

/** Empty string → null; otherwise trimmed. */
export function nz(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = raw.trim();
  return s === "" ? null : s;
}

/** A trimmed string parsed as a Postgres text[] literal from the recombinant "_text" fields ("{CA,NA}" or "CA,NA"). */
export function parseTextArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let s = raw.trim();
  if (!s) return [];
  if (s.startsWith("{") && s.endsWith("}")) s = s.slice(1, -1);
  return s
    .split(",")
    .map((x) => x.trim().replace(/^"|"$/g, ""))
    .filter((x) => x.length > 0);
}
