import Link from "next/link";
import { Nav } from "@/components/Nav";
import { listCachedBriefs } from "@/lib/briefs";

export default async function CounterfactualIndex() {
  const briefs = await listCachedBriefs("counterfactual");
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[720px] px-8 py-24">
        <h1 className="font-[var(--font-display)] text-[var(--text-display-2)] tracking-[var(--tracking-display)]">
          Counterfactual Briefs
        </h1>
        <p className="mt-6 text-[var(--text-body)] text-[var(--color-muted)]">
          For grants where the public record is silent, the system retrieves
          the eight to fifteen most comparable grants that do carry
          descriptions, the parent program&rsquo;s most recent Departmental
          Results Report, and any Auditor General coverage of the program.
          The brief states what comparable filings typically describe.
          It does not state what this grant should have described.
        </p>
        <ul className="mt-12 divide-y divide-[var(--color-rule)]">
          {briefs.map((b) => (
            <li key={b.slug} className="py-6">
              <Link
                href={`/counterfactual/${b.slug}`}
                className="block hover:text-[var(--color-paper)]"
              >
                <div className="font-[var(--font-display)] text-[var(--text-h2)]">
                  {b.title}
                </div>
                <div className="mt-2 font-[var(--font-mono)] text-[var(--text-small)] text-[var(--color-muted)]">
                  {b.tag}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
