"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/transparency", label: "Overview" },
  { href: "/transparency/departments", label: "Departments" },
  { href: "/transparency/recipients", label: "Recipients" },
  { href: "/transparency/programs", label: "Programs" },
  { href: "/transparency/forecasts", label: "Forecasts" },
  { href: "/transparency/risk", label: "Risk map" },
] as const;

export function DashboardTabs() {
  const path = usePathname();
  return (
    <nav
      aria-label="Transparency dashboard tabs"
      className="border-b border-[var(--color-border)] sticky top-20 z-20 bg-[var(--color-bg)]/85 backdrop-blur"
    >
      <div className="mx-auto max-w-[1280px] px-6">
        <ul className="flex gap-1 overflow-x-auto -mb-px">
          {TABS.map((t) => {
            const active =
              path === t.href ||
              (t.href !== "/transparency" && path?.startsWith(t.href + "/"));
            return (
              <li key={t.href}>
                <Link
                  href={t.href as never}
                  className={
                    "block px-4 py-3 text-[13px] tracking-tight border-b-2 transition-colors " +
                    (active
                      ? "border-[var(--color-accent)] text-[var(--color-fg)]"
                      : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]")
                  }
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
