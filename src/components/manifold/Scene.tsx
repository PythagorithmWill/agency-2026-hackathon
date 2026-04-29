"use client";

/**
 * Manifold Scene placeholder. Replaced by the R3F + GSAP scene in P4.
 * This stub keeps the dynamic import chain typed and the build green
 * during the move-to-/classic milestone.
 */
export function Scene() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-[var(--color-ink)] text-[var(--color-paper)]">
      <div className="text-center max-w-xl px-8">
        <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[0.12em] text-[var(--color-muted)]">
          Pythagorithm Manifold
        </div>
        <h1 className="mt-6 font-[var(--font-display)] text-[var(--text-display-2)] tracking-[var(--tracking-display)] leading-[1.05]">
          Five strata · twelve findings · one structure
        </h1>
        <p className="mt-6 text-[var(--text-body)] text-[var(--color-muted)] leading-[1.55]">
          The 3D scene is a separate bundle, loaded only when WebGL is
          present. The classic edition is always one click away in the
          bottom-right.
        </p>
      </div>
    </div>
  );
}
