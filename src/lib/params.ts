/**
 * Decode a dynamic route segment. Returns null for malformed percent-encoding
 * (e.g. a bare "%"), which callers turn into notFound() rather than a 500.
 */
export function decodeParam(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}
