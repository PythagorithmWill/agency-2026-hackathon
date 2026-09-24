import { notFound } from "next/navigation";
import { loadAllRecommendations } from "./load";

/**
 * Validates the recommendation id BEFORE any Suspense boundary. The list
 * page's loading.tsx used to sit at /recommendations and wrapped this
 * segment too, so an unknown id streamed the not-found UI into a 200
 * shell (soft 404). The list page now lives in the (list) route group;
 * this layout throws notFound() outside any loading boundary → real 404.
 */
export default async function RecommendationLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  // Page-segment params arrive percent-encoded (ids contain ":" → "%3A").
  let decoded: string;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    notFound();
  }
  const all = await loadAllRecommendations();
  if (!all.some((r) => r.id === decoded)) notFound();
  return children;
}
