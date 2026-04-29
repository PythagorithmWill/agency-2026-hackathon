"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The Strand — when a node is selected, the camera flies along a curved
 * Bezier path toward the node, and a tube geometry materializes along the
 * same path with the strand-draw shader.
 *
 * - Total camera animation: 1200ms cubic-bezier(0.16, 1, 0.3, 1)
 * - Tube draws over 700ms, ember stroke if HIGH risk
 * - On unmount (ESC or new node), the camera flies back to the origin
 */
export function CameraStrand({
  target,
  riskHigh,
}: {
  target: THREE.Vector3;
  riskHigh: boolean;
}) {
  const { camera } = useThree();
  const startRef = useRef(camera.position.clone());
  const elapsedRef = useRef(0);
  const tubeRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const endPos = useMemo(() => {
    const dir = target.clone().normalize();
    return target.clone().sub(dir.multiplyScalar(2.0)).add(new THREE.Vector3(0, 1.2, 0));
  }, [target]);

  // Curved Bezier control point pulled toward the visual center
  const control = useMemo(() => {
    const mid = startRef.current.clone().add(endPos).multiplyScalar(0.5);
    mid.y += 4;
    return mid;
  }, [endPos]);

  const curve = useMemo(
    () =>
      new THREE.QuadraticBezierCurve3(
        startRef.current.clone(),
        control,
        endPos.clone(),
      ),
    [control, endPos],
  );

  const tubeGeom = useMemo(
    () => new THREE.TubeGeometry(curve, 64, 0.025, 8, false),
    [curve],
  );

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(riskHigh ? "#E8693C" : "#F0EBE2") },
      uTime: { value: 0 },
    }),
    [riskHigh],
  );

  useEffect(() => {
    elapsedRef.current = 0;
  }, [target]);

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    const t = Math.min(1, elapsedRef.current / 1.2);
    const eased = 1 - Math.pow(1 - t, 5); // cubic-bezier(0.16, 1, 0.3, 1) approximation
    const cur = curve.getPointAt(eased);
    camera.position.lerp(cur, 0.18);
    camera.lookAt(target);

    if (matRef.current) {
      const drawT = Math.min(1, elapsedRef.current / 0.7);
      matRef.current.uniforms.uTime.value = drawT;
    }
  });

  return (
    <mesh ref={tubeRef} geometry={tubeGeom}>
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={STRAND_VS}
        fragmentShader={STRAND_FS}
      />
    </mesh>
  );
}

const STRAND_VS = /* glsl */ `
varying float vAlong;
void main() {
  vAlong = uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const STRAND_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying float vAlong;

void main() {
  float reveal = smoothstep(0.0, 1.0, uTime - vAlong);
  float alpha = reveal * (1.0 - vAlong * 0.4);
  gl_FragColor = vec4(uColor, alpha);
}
`;
