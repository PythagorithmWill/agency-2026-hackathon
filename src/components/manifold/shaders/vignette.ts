// Scene vignette — applied as a post-process or as a transparent
// foreground sphere shader. Soft radial darken toward the edges.
export const vignetteVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const vignetteFragment = /* glsl */ `
uniform sampler2D tDiffuse;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  vec2 center = vec2(0.5);
  float dist = distance(vUv, center);
  float vignette = smoothstep(0.8, 0.4, dist);
  color.rgb *= mix(0.6, 1.0, vignette);
  gl_FragColor = color;
}
`;
