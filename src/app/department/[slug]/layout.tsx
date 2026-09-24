import { notFound } from "next/navigation";
import { loadSnapshot } from "@/lib/analytics/snapshot";
import { deptSlug } from "./slug";

/**
 * Validates the department slug BEFORE the segment's loading.tsx Suspense
 * boundary, so an unknown department returns a real HTTP 404 instead of
 * a 200 with the not-found UI streamed into the loading shell.
 * loadSnapshot() is memoised in-process; this adds no I/O to the page.
 */
export default async function DepartmentLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const snap = await loadSnapshot();
  const found = snap?.topDepartments.some((d) => deptSlug(d.department) === slug);
  if (!found) notFound();
  return children;
}
