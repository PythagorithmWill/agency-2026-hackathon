import { notFound } from "next/navigation";
import { getPattern } from "@/lib/patterns/registry";

/**
 * Validates the pattern slug BEFORE the segment's loading.tsx Suspense
 * boundary. When page.tsx calls notFound() the loading shell has already
 * been flushed with HTTP 200, so an unknown slug rendered the not-found
 * UI as a soft 404. Throwing here — outside that boundary — yields a
 * real 404 status.
 */
export default async function PatternLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  if (!getPattern(slug)) notFound();
  return children;
}
