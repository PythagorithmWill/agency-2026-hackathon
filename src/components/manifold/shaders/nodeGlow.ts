// Node glow — radial falloff with intensity uniform.
// Used by every finding sphere on the strata. Color is content-meaningful:
// ember for HIGH/CRITICAL, sage for cleared, paper-low for MEDIUM/LOW.
export const nodeGlowVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const nodeGlowFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;

void main() {
  vec2 center = vec2(0.5);
  float dist = distance(vUv, center);
  float glow = exp(-dist * 6.0) * uIntensity;
  vec3 color = uColor * glow;
  gl_FragColor = vec4(color, glow);
}
`;
