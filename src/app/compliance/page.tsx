import Link from "next/link";

export const metadata = { title: "Alberta AI Usage Policy alignment — Glassbox" };

interface Row {
  requirement: string;
  implementation: string;
  status: "met" | "partial" | "deployment";
}

const ROWS: Row[] = [
  {
    requirement: "Sovereign compute",
    implementation:
      "Self-hosted federal and Alberta provincial data via the Render replica. No third-party AI involved in pattern detection. Calibrated-language enforcement is local regex; semantic retrieval is optional with explicit opt-in.",
    status: "met",
  },
  {
    requirement: "Open-source models",
    implementation:
      "All detection logic open-source under MIT. Pattern detectors live in src/lib/patterns/ as inspectable, testable modules.",
    status: "met",
  },
  {
    requirement: "Audit trails",
    implementation:
      "Every output carries an audit token chained to source-data tokens. The 'why this match?' trail can always be walked back to the source row.",
    status: "met",
  },
  {
    requirement: "Accountability for outputs",
    implementation:
      "Calibrated-language discipline (no fraud claims, no causal language); citation rigor (every match cites at least one source row from a named dataset).",
    status: "met",
  },
  {
    requirement: "Cybersecurity gates",
    implementation:
      "Deployment-stage requirement. AWS infrastructure scaffolding lives in infra/aws/security/ with placeholder Terraform stubs; production gates ship before any non-development deploy.",
    status: "deployment",
  },
];

const STATUS_LABEL: Record<Row["status"], { label: string; color: string }> = {
  met: { label: "Met", color: "var(--color-accent)" },
  partial: { label: "Partial", color: "var(--color-accent-warn)" },
  deployment: { label: "Deployment-stage", color: "var(--color-fg-subtle)" },
};

export default function CompliancePage() {
  return (
    <main className="min-h-screen pt-16">
      <section className="relative border-b border-[var(--color-border)] overflow-hidden">
        <div className="atmosphere-drift" aria-hidden />
        <div className="relative z-10 mx-auto max-w-[920px] px-6 pt-24 pb-12">
          <div className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Glassbox · compliance
          </div>
          <h1 className="mt-4 text-[var(--text-display-md)] leading-[0.95] tracking-[var(--tracking-display-md)]">
            Alberta AI Usage Policy alignment
          </h1>
          <p className="mt-6 text-[var(--text-body-lg)] italic text-[var(--color-fg-muted)] leading-[1.45]">
            Line-by-line correspondence between Alberta&apos;s public-sector AI policy and the
            Glassbox implementation. Glassbox is not endorsed by the Ministry; this page documents
            our design choices, not an external audit.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[920px] px-6 py-12">
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-[14px]">
            <thead className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)] bg-[var(--color-bg-elev-2)]">
              <tr>
                <th className="text-left py-3 px-5 border-b border-[var(--color-border)]">
                  Policy requirement
                </th>
                <th className="text-left py-3 px-5 border-b border-[var(--color-border)]">
                  Glassbox implementation
                </th>
                <th className="text-left py-3 px-5 border-b border-[var(--color-border)]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.requirement} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-4 px-5 align-top font-medium">{r.requirement}</td>
                  <td className="py-4 px-5 align-top text-[var(--color-fg-muted)] leading-[1.55]">
                    {r.implementation}
                  </td>
                  <td className="py-4 px-5 align-top whitespace-nowrap">
                    <span
                      className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em]"
                      style={{ color: STATUS_LABEL[r.status].color }}
                    >
                      {STATUS_LABEL[r.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-[var(--color-border)] py-12">
        <div className="mx-auto max-w-[920px] px-6 flex flex-wrap items-baseline justify-between gap-4">
          <Link
            href={"/trace" as never}
            className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ← Built on TRACE
          </Link>
          <Link
            href={"/methodology" as never}
            className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Methodology →
          </Link>
        </div>
      </section>
    </main>
  );
}
