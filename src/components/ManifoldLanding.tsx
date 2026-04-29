"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { hasWebGLSupport } from "@/lib/webgl-detect";

const ManifoldScene = dynamic(
  () => import("./manifold/Scene").then((m) => ({ default: m.Scene })),
  {
    ssr: false,
    loading: () => <SceneSkeleton />,
  },
);

/**
 * Manifold landing — runs the WebGL capability check on mount, redirects
 * to /classic if WebGL is unavailable, otherwise hands off to the dynamic
 * Scene import. The scene + R3F + GSAP are never bundled into /classic.
 */
export function ManifoldLanding() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "supported" | "unsupported">(
    "checking",
  );

  useEffect(() => {
    if (hasWebGLSupport()) {
      setStatus("supported");
    } else {
      setStatus("unsupported");
      router.replace("/classic");
    }
  }, [router]);

  if (status !== "supported") {
    return <SceneSkeleton />;
  }

  return <ManifoldScene />;
}

function SceneSkeleton() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-[var(--color-ink)]">
      <div className="text-center">
        <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[0.12em] text-[var(--color-muted)]">
          The Manifold
        </div>
        <div className="mt-4 font-[var(--font-display)] text-[var(--text-h1)] tracking-[var(--tracking-tight)] text-[var(--color-paper)]">
          Resolving strata
        </div>
      </div>
    </div>
  );
}
