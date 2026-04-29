// Strata-ring breathing — slow opacity oscillation when active, flat when
// idle. Active state is content-driven (the user has descended into a
// specific stratum) so the breathing means something.
export const ringBreatheVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const ringBreatheFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uActive;        // 0 = idle, 1 = active
uniform float uTime;          // seconds since mount
uniform float uRiskHigh;      // 0 = sage path, 1 = ember path

varying vec2 vUv;

void main() {
  float breathe = uActive > 0.5
    ? 0.6 + 0.25 * sin(uTime * 1.3)
    : 0.3;
  vec3 base = mix(uColor, vec3(0.91, 0.41, 0.235), uRiskHigh); // ember on HIGH
  gl_FragColor = vec4(base, breathe);
}
`;
