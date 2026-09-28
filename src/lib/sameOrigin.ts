const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://glassbox.pythagorithm.ai";

/**
 * Cross-site request guard for state-changing POST routes. Browsers send an
 * Origin header on cross-site POSTs; when present it must be this site (the
 * canonical URL, the request's own origin, or the forwarded host). Requests
 * without an Origin (curl, server-to-server) are allowed: this blocks
 * another website from making a visitor's browser submit, not direct use.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return origin !== "null";
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const allowed = new Set<string>();
  try { allowed.add(new URL(SITE_URL).host); } catch { /* ignore */ }
  try { allowed.add(new URL(request.url).host); } catch { /* ignore */ }
  for (const h of [request.headers.get("x-forwarded-host"), request.headers.get("host")]) if (h) allowed.add(h.split(",")[0].trim());
  return allowed.has(host);
}
