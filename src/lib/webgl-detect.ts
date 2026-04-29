/**
 * Runtime WebGL capability check. Returns true if the browser can compile
 * a trivial vertex shader. Used to decide whether to load the 3D Manifold
 * bundle or redirect to /classic.
 */
export function hasWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ||
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    if (!vs) return false;
    gl.shaderSource(vs, "void main(){gl_Position=vec4(0,0,0,1);}");
    gl.compileShader(vs);
    return gl.getShaderParameter(vs, gl.COMPILE_STATUS) === true;
  } catch {
    return false;
  }
}
