import Link from "next/link";
import { ClassicNav } from "@/components/ClassicNav";
import { listCachedBriefs } from "@/lib/briefs";

export default async function OutcomeIndex() {
  const briefs = await listCachedBriefs("outcome");
  return (
    <>
      <ClassicNav />
      <main className="mx-auto max-w-[720px] px-8 py-24">
        <h1 className="font-[var(--font-display)] text-[var(--text-display-2)] tracking-[var(--tracking-display)]">
          Outcome Briefs
        </h1>
        <p className="mt-6 text-[var(--text-body)] text-[var(--color-muted)]">
          For grants greater than one million dollars where the public record
          carries no description, the brief assembles what the Auditor General,
          Departmental Results Reports, Hansard, and contemporaneous reporting
          show — every claim cited, no claim unsourced.
        </p>
        <ul className="mt-12 divide-y divide-[var(--color-rule)]">
          {briefs.map((b) => (
            <li key={b.slug} className="py-6">
              <Link
                href={`/classic/outcome/${b.slug}` as never}
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
