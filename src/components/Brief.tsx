import type { OutcomeBrief } from "@/lib/types";
import { ProofTokenStrip } from "./ProofTokenStrip";
import { ComparableGrants } from "./ComparableGrants";

/**
 * The Brief — the showpiece document. Single-column max-width 720px,
 * Fraunces display headline, marginal citations on desktop, Proof token
 * strip across the bottom. Editorial gravity, not SaaS dashboard.
 *
 * Renders both Outcome Brief and Counterfactual Brief — the latter adds
 * a comparable-grants panel under the body.
 */
export function Brief({ brief }: { brief: OutcomeBrief }) {
  const cad = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

  return (
    <article className="brief-body mx-auto max-w-[952px] px-8 py-24 lg:grid lg:grid-cols-[720px_200px] lg:gap-8">
      <div>
        <header>
          <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
            {brief.briefType === "outcome" ? "Outcome Brief" : "Counterfactual Brief"}
          </div>
          <h1 className="mt-6 font-[var(--font-display)] text-[var(--text-display-1)] tracking-[var(--tracking-display)] leading-[1.05]">
            {brief.subject.canonicalName}
          </h1>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-2 font-[var(--font-mono)] text-[var(--text-small)] text-[var(--color-muted)]">
            <span>BN {brief.identity.bnRoot ?? "—"}</span>
            <span>{brief.governmentRecords.dateRangeStart.slice(0, 4)}–{brief.governmentRecords.dateRangeEnd.slice(0, 4)}</span>
            <span>{brief.governmentRecords.awardingDepartments.join(" · ")}</span>
            <span className="text-[var(--color-paper)]">{cad.format(brief.governmentRecords.totalAgreementValue)}</span>
          </div>
        </header>

        <section className="mt-16">
          <h2 className="font-[var(--font-display)] text-[var(--text-h1)] tracking-[var(--tracking-tight)]">
            What the government&rsquo;s records show
          </h2>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 font-[var(--font-mono)] text-[var(--text-mono)]">
            <Stat label="Current commitment" value={cad.format(brief.governmentRecords.totalAgreementValue)} />
            <Stat label="Amendment count" value={String(brief.governmentRecords.amendmentCount)} />
            <Stat label="Awarding departments" value={brief.governmentRecords.awardingDepartments.join(", ")} />
            <Stat label="Recipient province" value={brief.governmentRecords.province} />
            <Stat
              label="Date range"
              value={`${brief.governmentRecords.dateRangeStart.slice(0, 10)} → ${brief.governmentRecords.dateRangeEnd.slice(0, 10)}`}
            />
            <Stat label="Programs" value={brief.governmentRecords.programCodes.join(", ")} />
          </dl>
        </section>

        {brief.publicSources.map((section, i) => (
          <section key={i} className="mt-16">
            <h2 className="font-[var(--font-display)] text-[var(--text-h1)] tracking-[var(--tracking-tight)]">
              {section.sectionHeading}
            </h2>
            <div className="mt-6 space-y-5 text-[var(--text-body)] leading-[1.55]">
              {section.sentences.map((s, j) => (
                <p key={j} className={i === 0 && j === 0 ? "has-drop-cap" : undefined}>
                  {s.text}
                  {s.citations.map((c, k) => (
                    <CitationRef
                      key={k}
                      id={c}
                      index={k + 1}
                      sources={brief.sources}
                    />
                  ))}
                </p>
              ))}
            </div>
          </section>
        ))}

        {brief.pullQuote && (
          <blockquote className="my-16 border-l border-[var(--color-rule)] pl-8 font-[var(--font-display)] text-[var(--text-h1)] italic leading-[1.3] tracking-[var(--tracking-tight)]">
            &ldquo;{brief.pullQuote.text}&rdquo;
            <footer className="mt-3 font-[var(--font-sans)] text-[var(--text-small)] not-italic uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
              — {brief.pullQuote.attribution}
            </footer>
          </blockquote>
        )}

        {brief.unverifiable.length > 0 && (
          <section className="mt-16">
            <h2 className="font-[var(--font-display)] text-[var(--text-h1)] tracking-[var(--tracking-tight)]">
              What remains unverifiable
            </h2>
            <ul className="mt-6 space-y-4">
              {brief.unverifiable.map((u, i) => (
                <li
                  key={i}
                  className="border-l border-[var(--color-rule)] pl-6 text-[var(--text-body)] leading-[1.55]"
                >
                  <div className="font-[var(--font-display)]">{u.claim}</div>
                  <div className="mt-2 text-[var(--color-muted)]">
                    {u.rationale}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {brief.briefType === "counterfactual" && brief.comparableGrants && (
          <ComparableGrants grants={brief.comparableGrants} />
        )}

        <section className="mt-20">
          <h2 className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
            Sources
          </h2>
          <ol className="mt-4 space-y-3 font-[var(--font-mono)] text-[var(--text-mono)]">
            {brief.sources.map((src, i) => (
              <li key={src.id} id={src.id} className="leading-[1.5]">
                <span className="text-[var(--color-muted)]">[{i + 1}]</span>{" "}
                <span className="text-[var(--color-paper)]">{src.title}</span>
                {src.year && (
                  <span className="text-[var(--color-muted)]">, {src.year}</span>
                )}
                {src.url && (
                  <>
                    {" "}
                    <a
                      href={src.url}
                      className="text-[var(--color-muted)] underline-offset-2 hover:text-[var(--color-paper)]"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {hostnameOf(src.url)}
                    </a>
                  </>
                )}
                <span className="ml-2 text-[var(--color-muted)]">
                  · tier {src.authorityTier}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-16 border-t border-[var(--color-rule)] pt-8">
          <ProofTokenStrip token={brief.proofToken} />
        </footer>

        {/* METHODOLOGY footer block + CITE AS line */}
        <section className="mt-16 border-t border-[var(--color-rule)] pt-8">
          <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
            Methodology
          </div>
          <p className="mt-3 text-[var(--text-small)] leading-[1.55] text-[var(--color-paper)]">
            This brief was generated under the Pythagorithm Proof
            Methodology v{brief.proofToken.version}: every prose claim
            carries a source pointer; direct quotes are capped at fifteen
            words and at one quote per source; calibrated language is
            enforced by a published regex set; entity-resolution
            confidence thresholds gate any claim about a named individual.
            See{" "}
            <a
              href="/methodology"
              className="text-[var(--color-paper)] underline-offset-2 hover:underline"
            >
              the methodology page
            </a>{" "}
            for the canonical schema, the validator, and the AIA
            structural correspondence.
          </p>
        </section>

        <p className="mt-12 font-[var(--font-mono)] italic text-[var(--text-small)] text-[var(--color-muted)] leading-[1.5]">
          Cite as: Pythagorithm Proof Methodology v{brief.proofToken.version},{" "}
          {brief.subject.canonicalName} brief ({brief.briefId}), retrieved{" "}
          {brief.proofToken.issuedAt.slice(0, 10)}.
        </p>
      </div>

      {/* Marginal-notes column on desktop */}
      <aside className="hidden lg:block">
        <div className="sticky top-12 space-y-8">
          <MarginNote
            heading="Brief identity"
            body={brief.briefId}
          />
          <MarginNote
            heading="Issued"
            body={new Date(brief.proofToken.issuedAt).toUTCString()}
          />
          <MarginNote
            heading="Citations"
            body={`${brief.sources.length} sources cited; ${brief.publicSources.flatMap((s) => s.sentences).length} sentence-level citations`}
          />
          <MarginNote
            heading="Disclaimer"
            body="These are observations from public records. They are not findings of misconduct."
          />
        </div>
      </aside>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-[var(--color-paper)]">{value}</dd>
    </div>
  );
}

function CitationRef({
  id,
  index,
  sources,
}: {
  id: string;
  index: number;
  sources: OutcomeBrief["sources"];
}) {
  const src = sources.find((s) => s.id === id);
  return (
    <span className="group relative inline-block">
      <a
        href={`#${id}`}
        className="ml-1 align-super font-[var(--font-mono)] text-[0.65em] text-[var(--color-muted)] hover:text-[var(--color-paper)]"
      >
        [{index}]
      </a>
      {src && (
        <span
          role="tooltip"
          className="invisible group-hover:visible absolute z-20 left-0 top-full mt-2 w-[320px] border border-[var(--color-rule)] bg-[var(--color-vellum)] rounded-[6px] p-4 text-[var(--text-small)] leading-[1.5] text-[var(--color-paper)] no-print"
        >
          <span className="block font-[var(--font-display)] text-[var(--text-small)] not-italic leading-snug">
            {src.title}
          </span>
          {src.year && (
            <span className="block font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)] mt-1">
              {src.kind} · {src.year} · authority tier {src.authorityTier}
            </span>
          )}
          {src.url && (
            <span className="block font-[var(--font-mono)] text-[var(--text-micro)] text-[var(--color-muted)] mt-2 break-all">
              {hostnameOf(src.url)}
            </span>
          )}
          <span className="block font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)] mt-3">
            Retrieved via PYTH-RES at {src.retrievalDate}
          </span>
        </span>
      )}
    </span>
  );
}

function MarginNote({ heading, body }: { heading: string; body: string }) {
  return (
    <div>
      <div className="text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
        {heading}
      </div>
      <div className="mt-1 font-[var(--font-mono)] text-[var(--text-small)] text-[var(--color-paper)]">
        {body}
      </div>
    </div>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
