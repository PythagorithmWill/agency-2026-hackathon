import type { PatternMatchRow } from "@/lib/patterns/store";

/**
 * "What was observed" for a match: renders the detector's evidence so a
 * reader can see WHY it was flagged, not just that it was. Generic
 * field/value list for every pattern; amendment-purpose-drift gets a
 * side-by-side of the two descriptions with the keywords that dropped
 * out and the keywords that appeared.
 */
type Ev = PatternMatchRow["evidence"][number];

const LABELS: Record<string, string> = {
  description_similarity: "Keyword overlap (Jaccard)",
  amendment_count: "Amendments on record",
  value_change: "Value, original → current",
  department: "Department",
  keywords_shared: "Keywords shared",
  current_start_date: "Current row start date",
  total_value: "Total value",
  last_grant: "Last agreement start",
  months_silent: "Months since last agreement",
  agreement_count: "Agreements",
  department_count: "Departments",
  hhi: "HHI",
  top_share: "Top recipient share",
  ratio: "Growth ratio (latest ÷ original)",
  original_value: "Original value",
  final_value: "Current value",
};
const LONG_FIELDS = new Set(["initial_description", "current_description", "keywords_only_in_initial", "keywords_only_in_current"]);

function label(field: string): string {
  return LABELS[field] ?? field.replace(/_/g, " ");
}
function fmt(v: Ev["value"]): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("en-CA");
  return String(v);
}
function pick(ev: Ev[], field: string): string | null {
  const hit = ev.find((e) => e.field === field);
  return hit && hit.value != null && hit.value !== "" ? String(hit.value) : null;
}
function chips(csv: string | null) {
  if (!csv || csv === "—") return <span className="text-[var(--color-fg-subtle)]">none</span>;
  return csv.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
    <span key={t} className="inline-block mr-1.5 mb-1.5 px-2 py-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-2)] font-[var(--font-mono)] text-[11px]">
      {t}
    </span>
  ));
}

export function MatchObservations({ patternId, evidence }: { patternId: string; evidence: Ev[] }) {
  if (!evidence || evidence.length === 0) return null;
  const generic = evidence.filter((e) => !LONG_FIELDS.has(e.field));
  const isDrift = patternId === "amendment-purpose-drift";
  const initial = pick(evidence, "initial_description");
  const current = pick(evidence, "current_description");
  const sim = pick(evidence, "description_similarity");

  return (
    <details className="mt-4 group">
      <summary className="cursor-pointer list-none font-[var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-accent)] hover:underline">
        <span className="group-open:hidden">Show observations ({evidence.length} cited fields)</span>
        <span className="hidden group-open:inline">Hide observations</span>
      </summary>
      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-2)]/40 p-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
          {generic.map((e, i) => (
            <div key={`${e.field}-${i}`} className="flex items-baseline justify-between gap-3 border-b border-[var(--color-border)] py-1">
              <dt className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">{label(e.field)}</dt>
              <dd className="text-right font-[var(--font-mono)] tabular-nums break-words">
                {e.field === "description_similarity" && sim ? `${(Number(sim) * 100).toFixed(0)}%` : fmt(e.value)}
              </dd>
            </div>
          ))}
        </dl>

        {isDrift && (initial || current) && (
          <div className="mt-5">
            <p className="text-[13px] text-[var(--color-fg-muted)] leading-[1.5]">
              The flag rests on these two published descriptions of the same agreement: the
              original row and the latest amendment row. Keyword overlap is
              {" "}{sim ? `${(Number(sim) * 100).toFixed(0)}%` : "—"}; the detector flags agreements
              with three or more amendments whose overlap is below 30%.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">Initial description (amendment 0)</div>
                <p className="mt-2 text-[13px] leading-[1.55] whitespace-pre-wrap">{initial ?? "—"}</p>
                <div className="mt-3 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">Keywords that disappeared</div>
                <div className="mt-1.5">{chips(pick(evidence, "keywords_only_in_initial"))}</div>
              </div>
              <div>
                <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">Current description (latest amendment)</div>
                <p className="mt-2 text-[13px] leading-[1.55] whitespace-pre-wrap">{current ?? "—"}</p>
                <div className="mt-3 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">Keywords that appeared</div>
                <div className="mt-1.5">{chips(pick(evidence, "keywords_only_in_current"))}</div>
              </div>
            </div>
          </div>
        )}
        {isDrift && !initial && (
          <p className="mt-4 text-[12px] text-[var(--color-fg-subtle)]">
            Description excerpts are recorded from the next detector run; open the source record to compare the rows now.
          </p>
        )}
      </div>
    </details>
  );
}
