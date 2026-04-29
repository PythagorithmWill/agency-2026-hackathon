"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { FindingCard } from "@/lib/types";
import type { StratumId } from "./Strata";
import { STRATA_DEFS } from "./Strata";
import { nodeGlowFragment, nodeGlowVertex } from "./shaders/nodeGlow";

interface PlacedNode {
  finding: FindingCard;
  position: THREE.Vector3;
  stratumId: StratumId;
  isHigh: boolean;
}

/**
 * Distribute findings across strata. AIA-related findings (anything with
 * 'AIA' in the canonical name) sit on S3; loop participations on S4
 * (source-linked); everything else on S4 by default.
 *
 * Theta is derived from a deterministic hash of the proofId so positions
 * are stable across reloads (no jitter when the user clicks back).
 */
function placeFinding(f: FindingCard): PlacedNode {
  const name = f.proofToken.finding.subject.canonicalName.toLowerCase();
  const stratumId: StratumId =
    name.includes("aia") || f.proofToken.finding.type === "outcome_gap"
      ? "S3"
      : "S4";

  const stratum = STRATA_DEFS.find((s) => s.id === stratumId)!;
  const hash = simpleHash(f.proofToken.proofId);
  const theta = (hash % 360) * (Math.PI / 180);
  const x = stratum.radius * Math.cos(theta);
  const z = stratum.radius * Math.sin(theta);

  const isHigh =
    f.proofToken.finding.scoreLabel === "HIGH" ||
    f.proofToken.finding.scoreLabel === "CRITICAL";

  return {
    finding: f,
    position: new THREE.Vector3(x, 0, z),
    stratumId,
    isHigh,
  };
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Nodes({
  findings,
  onSelect,
}: {
  findings: FindingCard[];
  onSelect: (placed: PlacedNode) => void;
}) {
  const placed = useMemo(() => findings.map(placeFinding), [findings]);
  return (
    <group>
      {placed.map((p) => (
        <Node key={p.finding.proofToken.proofId} placed={p} onSelect={onSelect} />
      ))}
    </group>
  );
}

function Node({
  placed,
  onSelect,
}: {
  placed: PlacedNode;
  onSelect: (p: PlacedNode) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const colorHex = placed.isHigh
    ? "#E8693C"
    : placed.finding.proofToken.finding.scoreLabel === "LOW"
      ? "#6B8E7F"
      : "#F0EBE2";

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(colorHex) },
      uIntensity: { value: 1.2 },
    }),
    [colorHex],
  );

  useFrame(() => {
    if (meshRef.current) {
      const target = hovered ? 1.4 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.18);
    }
    if (matRef.current) {
      matRef.current.uniforms.uIntensity.value = hovered ? 2.4 : 1.2;
    }
  });

  return (
    <group position={placed.position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(placed);
        }}
      >
        <sphereGeometry args={[0.12, 24, 24]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={nodeGlowVertex}
          fragmentShader={nodeGlowFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>

      {hovered && (
        <Html
          position={[0.25, 0.25, 0]}
          center={false}
          style={{ pointerEvents: "none" }}
        >
          <div className="border border-[var(--color-rule)] bg-[var(--color-vellum)]/95 rounded-[6px] px-3 py-2 min-w-[220px]">
            <div className="font-[var(--font-display)] text-[14px] leading-tight text-[var(--color-paper)]">
              {placed.finding.proofToken.finding.subject.canonicalName}
            </div>
            <div className="mt-1 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]">
              {placed.finding.proofToken.finding.scoreLabel} ·{" "}
              {placed.finding.proofToken.finding.score}/30
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export type { PlacedNode };
