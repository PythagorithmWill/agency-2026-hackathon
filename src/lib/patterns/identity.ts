/**
 * Recipient-identifier hygiene shared by every pattern detector.
 *
 * `fed.grants_contributions.recipient_business_number` is a format
 * polyglot (KNOWN-DATA-ISSUES F-6): besides real 9- and 15-character
 * CRA business numbers it carries literal placeholder text. Counted on
 * the live corpus (2026-09-24): "0" ×18,522, "000000000" ×2,741,
 * "-" ×894, "n/a" ×403, "none" ×64, "0000000000" ×10. Detectors that
 * build `subject.id` with `bn ?? legal_name` were emitting links like
 * `/recipient/None` and `/recipient/0`, which can never resolve.
 *
 * `normalizeBn` maps every such placeholder to `null` so callers fall
 * back to the legal name (the recipient page supports name lookup).
 * It does NOT attempt to canonicalise real BNs (strip RR/RT suffixes,
 * remove embedded spaces) — that is entity-resolution work that lives
 * in `general.entity_golden_records`.
 */

const NULL_LIKE_TOKEN_LIST = [
  "",
  "none",
  "null",
  "undefined",
  "nan",
  "n/a",
  "na",
  "-",
] as const;
const NULL_LIKE_TOKENS = new Set<string>(NULL_LIKE_TOKEN_LIST);

/**
 * SQL predicate equivalent of `isNullLikeId(column)`, for detectors that
 * need to filter placeholder BNs server-side (ghost-capacity). Built
 * from the same token list so the two never drift. `column` must be a
 * trusted identifier, never user input.
 */
export function nullLikeBnSql(column: string): string {
  const literals = NULL_LIKE_TOKEN_LIST.map((t) => `'${t}'`).join(", ");
  return `(${column} IS NULL
       OR lower(trim(${column})) IN (${literals})
       OR trim(${column}) ~ '^0+$')`;
}

/** True when the value is null/undefined or a known placeholder token. */
export function isNullLikeId(value: string | null | undefined): boolean {
  if (value == null) return true;
  const v = value.trim().toLowerCase();
  if (NULL_LIKE_TOKENS.has(v)) return true;
  // All-zero digit strings ("0", "00", "000000000", "0000000000") are
  // the publisher's "unknown" placeholder (KNOWN-DATA-ISSUES F-6, C-3).
  return /^0+$/.test(v);
}

/**
 * Return the trimmed BN, or `null` when the stored value is a
 * placeholder. Use as `normalizeBn(row.bn) ?? row.legal_name`.
 */
export function normalizeBn(value: string | null | undefined): string | null {
  if (isNullLikeId(value)) return null;
  return (value as string).trim();
}
