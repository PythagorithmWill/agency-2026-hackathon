import type { OutcomeBrief } from "@/lib/types";

/**
 * Counterfactual Brief addition — 8–15 comparable grants with descriptions.
 * Tier-bucketed: 1 exact match, 2 ±5 years, 3 parent department fallback.
 * Each row shows the description (what comparable filings DO state),
 * never what the subject grant should state.
 */
export function ComparableGrants({
  grants,
}: {
  grants: NonNullable<OutcomeBrief["comparableGrants"]>;
}) {
  const cad = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

  const grouped = {
    1: grants.filter((g) => g.similarityTier === 1),
    2: grants.filter((g) => g.similarityTier === 2),
    3: grants.filter((g) => g.similarityTier === 3),
  } as const;

  return (
    <section className="mt-16">
      <h2 className="font-[var(--font-display)] text-[var(--text-h1)] tracking-[var(--tracking-tight)]">
        Comparable filings — what briefs in this category typically state
      </h2>
      <p className="mt-4 text-[var(--text-small)] text-[var(--color-muted)]">
        {grants.length} comparable grants retrieved. Tier 1 matches the same
        program code and dollar bucket; Tier 2 widens the window to ±5 fiscal
        years; Tier 3 falls back to parent-department program family.
      </p>

      {([1, 2, 3] as const).map((tier) =>
        grouped[tier].length > 0 ? (
          <div key={tier} className="mt-8">
            <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
              Tier {tier} · {tierLabel(tier)} · {grouped[tier].length} grants
            </div>
            <ul className="mt-3 divide-y divide-[var(--color-rule)]">
              {grouped[tier].map((g) => (
                <li key={g.grantId} className="grid grid-cols-[1fr_120px] gap-6 py-4">
                  <div>
                    <div className="text-[var(--text-body-ui)] leading-[1.5] line-clamp-2">
                      {g.description}
                    </div>
                    <div className="mt-2 font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
                      {g.departmentCode} · FY{g.fiscalYear}
                    </div>
                  </div>
                  <div className="text-right font-[var(--font-mono)] text-[var(--text-small)] text-[var(--color-paper)]">
                    {cad.format(g.amount)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </section>
  );
}

function tierLabel(tier: 1 | 2 | 3): string {
  return tier === 1
    ? "exact program + dollar bucket"
    : tier === 2
      ? "same program, ±5 fiscal years"
      : "parent-department fallback";
}
