/**
 * URL slug for a department name. Shared by the segment layout (404 gate)
 * and page.tsx; colocated here because page/layout modules may only export
 * Next.js route fields.
 */
export function deptSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
