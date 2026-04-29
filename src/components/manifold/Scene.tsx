"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { Strata, type StratumId } from "./Strata";
import { Nodes, type PlacedNode } from "./Nodes";
import { CameraStrand } from "./CameraStrand";
import { BriefOverlay } from "./BriefOverlay";
import { ClassicViewLink } from "../ClassicViewLink";
import findingsData from "@/data/findings.json";
import type { FindingCard } from "@/lib/types";

/**
 * The Manifold scene — five tilted strata as torus rings, findings as
 * glowing nodes on the rings, the Strand interaction (camera path along
 * a Bézier from current viewpoint to the clicked node), and the Brief
 * overlay slide-in.
 *
 * The scene only animates when something is happening — slow rotation of
 * the strata group is the one continuous motion (60-second period). The
 * Strand only fires on click. No idle ambient bouncing or rotation on
 * individual nodes.
 */
export function Scene() {
  const findings = findingsData as unknown as FindingCard[];
  const [selected, setSelected] = useState<PlacedNode | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const activeStratum: StratumId | null = selected?.stratumId ?? null;
  const riskHigh = selected?.isHigh ?? false;

  useEffect(() => {
    if (selected || briefOpen) {
      setShowHint(false);
      return;
    }
    const t = setTimeout(() => setShowHint(true), 30_000);
    return () => clearTimeout(t);
  }, [selected, briefOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (briefOpen) setBriefOpen(false);
        else if (selected) setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, briefOpen]);

  const sceneStyle = useMemo<React.CSSProperties>(
    () => ({
      opacity: briefOpen ? 0.3 : 1,
      transition: "opacity 350ms cubic-bezier(0.16, 1, 0.3, 1)",
    }),
    [briefOpen],
  );

  return (
    <div className="fixed inset-0 bg-[var(--color-ink)]">
      <div className="absolute inset-0" style={sceneStyle}>
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.setClearColor("#1A1816", 1);
          }}
        >
          <PerspectiveCamera makeDefault fov={50} position={[0, 6, 18]} />
          <fog attach="fog" args={["#1A1816", 12, 40]} />
          <ambientLight intensity={0.15} color="#F0EBE2" />
          <directionalLight position={[10, 10, 5]} intensity={0.6} color="#F0EBE2" />
          <pointLight position={[0, 0, 0]} intensity={0.4} color="#E8693C" />

          <Suspense fallback={null}>
            <Strata activeId={activeStratum} riskHigh={riskHigh} />
            <Nodes findings={findings} onSelect={setSelected} />
            {selected && <CameraStrand target={selected.position} riskHigh={riskHigh} />}
          </Suspense>
        </Canvas>
      </div>

      {/* Header strip */}
      <header className="absolute top-0 inset-x-0 z-10 px-8 py-6 no-print pointer-events-none">
        <div className="flex items-baseline justify-between font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[0.12em] text-[var(--color-muted)]">
          <span>Pythagorithm Manifold</span>
          <span>10 findings · 5 strata</span>
        </div>
      </header>

      {/* Selected node panel — appears at top-right when a node is selected */}
      {selected && !briefOpen && (
        <NodePanel
          placed={selected}
          onClose={() => setSelected(null)}
          onOpenBrief={() => setBriefOpen(true)}
        />
      )}

      {/* Brief overlay */}
      {selected && (
        <BriefOverlay
          finding={selected.finding}
          open={briefOpen}
          onClose={() => setBriefOpen(false)}
        />
      )}

      {/* Idle hint */}
      {showHint && !selected && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
          <span className="inline-flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-sage)]" />
            Click any node to descend the strata · press ESC to return
          </span>
        </div>
      )}

      <ClassicViewLink />
    </div>
  );
}

function NodePanel({
  placed,
  onClose,
  onOpenBrief,
}: {
  placed: PlacedNode;
  onClose: () => void;
  onOpenBrief: () => void;
}) {
  const f = placed.finding.proofToken.finding;
  const cad = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });
  // Render the first numeric piece of evidence as the headline figure.
  const headlineEvidence = placed.finding.proofToken.evidence.find(
    (e) => typeof e.value === "number",
  );

  return (
    <div className="absolute top-20 right-8 z-10 w-[380px] border border-[var(--color-rule)] bg-[var(--color-vellum)]/95 rounded-[8px] p-6 backdrop-blur-[2px]">
      <div className="flex items-baseline justify-between font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
        <span>Stratum {placed.stratumId}</span>
        <button onClick={onClose} className="hover:text-[var(--color-paper)]">
          Close (Esc)
        </button>
      </div>
      <h2 className="mt-3 font-[var(--font-display)] text-[1.5rem] leading-tight tracking-[var(--tracking-tight)]">
        {f.subject.canonicalName}
      </h2>
      <p className="mt-3 text-[var(--text-small)] text-[var(--color-paper)] leading-[1.5]">
        {f.summary}
      </p>
      <div className="mt-4 flex items-baseline gap-4">
        <span
          className={`font-[var(--font-mono)] text-[1.75rem] leading-none ${
            placed.isHigh ? "text-[var(--color-ember)]" : "text-[var(--color-paper)]"
          }`}
        >
          {f.score}
        </span>
        <span className="font-[var(--font-mono)] text-[var(--text-micro)] text-[var(--color-muted)] uppercase tracking-[var(--tracking-wide)]">
          / 30 · {f.scoreLabel}
        </span>
      </div>
      {headlineEvidence && (
        <div className="mt-4 font-[var(--font-mono)] text-[var(--text-small)] text-[var(--color-muted)]">
          {headlineEvidence.source}
          {typeof headlineEvidence.value === "number" && (
            <>
              {" → "}
              <span className="text-[var(--color-paper)]">
                {Math.abs(headlineEvidence.value) >= 1000
                  ? cad.format(headlineEvidence.value)
                  : headlineEvidence.value}
              </span>
            </>
          )}
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3 text-[var(--text-small)]">
        <button
          onClick={onOpenBrief}
          className="border border-[var(--color-paper)] text-[var(--color-paper)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)] transition-colors px-4 py-2 rounded-[6px]"
        >
          Open Outcome Brief →
        </button>
        <a
          href={`/proof/rerun/${placed.finding.proofToken.proofId}`}
          className="text-[var(--color-muted)] hover:text-[var(--color-paper)] underline-offset-2 hover:underline px-2 py-2"
        >
          Adjust weights ↗
        </a>
      </div>
    </div>
  );
}
