"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { ringBreatheVertex, ringBreatheFragment } from "./shaders/ringBreathe";
import * as THREE from "three";

export const STRATA_DEFS = [
  { id: "S1", radius: 8.0, label: "S1 EPISODIC · PYTH-LEAD" },
  { id: "S2", radius: 6.4, label: "S2 PROCEDURAL · PYTH-FE / OPS / DEMO" },
  { id: "S3", radius: 4.8, label: "S3 SEMANTIC · PYTH-SYN / GOV" },
  { id: "S4", radius: 3.2, label: "S4 SOURCE-LINKED · PYTH-DB / RES" },
  { id: "S5", radius: 1.6, label: "S5 ARCHIVAL · (delegated)" },
] as const;

export type StratumId = (typeof STRATA_DEFS)[number]["id"];

export function Strata({
  activeId,
  riskHigh,
}: {
  activeId: StratumId | null;
  riskHigh: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) {
      // 60-second period rotation; aborted in reduced-motion contexts via
      // the no-op fallback in the framer-motion wrapper at the route.
      groupRef.current.rotation.y = clock.elapsedTime * (Math.PI / 30);
    }
  });

  return (
    <group ref={groupRef} rotation={[-0.35, 0, 0]}>
      {STRATA_DEFS.map((s) => (
        <StratumRing
          key={s.id}
          radius={s.radius}
          label={s.label}
          isActive={activeId === s.id}
          riskHigh={riskHigh && activeId === s.id}
        />
      ))}
    </group>
  );
}

function StratumRing({
  radius,
  label,
  isActive,
  riskHigh,
}: {
  radius: number;
  label: string;
  isActive: boolean;
  riskHigh: boolean;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#F0EBE2") },
      uActive: { value: isActive ? 1 : 0 },
      uTime: { value: 0 },
      uRiskHigh: { value: riskHigh ? 1 : 0 },
    }),
    [isActive, riskHigh],
  );

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime;
      matRef.current.uniforms.uActive.value = isActive ? 1 : 0;
      matRef.current.uniforms.uRiskHigh.value = riskHigh ? 1 : 0;
    }
  });

  return (
    <group>
      <mesh>
        <torusGeometry args={[radius, 0.04, 16, 240]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={ringBreatheVertex}
          fragmentShader={ringBreatheFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
      <Text
        position={[radius + 0.6, 0, 0]}
        fontSize={0.18}
        color="#8A8580"
        anchorX="left"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}
