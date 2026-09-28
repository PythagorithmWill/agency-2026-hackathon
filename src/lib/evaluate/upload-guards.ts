/** Upload guards for /api/draft/extract (kept outside the route file so they can be tested). */

/** .docx guards: a small zip can expand to gigabytes of XML (a "zip bomb"). */
export const MAX_DOCX_ENTRIES = 2_000;
export const MAX_DOCX_UNCOMPRESSED = 50 * 1024 * 1024;
export const MAX_DOCX_DOCUMENT_XML = 20 * 1024 * 1024;

/**
 * Inspect a .docx (ZIP) central directory without inflating anything and
 * return a reason to refuse it, or null. Refuses ZIP64, too many entries,
 * a total uncompressed size over 50 MB, or word/document.xml over 20 MB.
 */
export function docxProblem(b: Uint8Array): string | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // End-of-central-directory record: last 22 bytes + up to 64 KiB of comment.
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65_535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return "not a valid zip";
  const entries = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (entries === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) return "zip64 archives are not accepted";
  if (entries > MAX_DOCX_ENTRIES) return "too many parts";
  if (cdOffset + cdSize > b.length) return "damaged zip";
  let p = cdOffset, total = 0, documentXml = -1;
  for (let n = 0; n < entries; n++) {
    if (p + 46 > b.length || view.getUint32(p, true) !== 0x02014b50) return "damaged zip";
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true), extraLen = view.getUint16(p + 30, true), commentLen = view.getUint16(p + 32, true);
    if (size === 0xffffffff) return "zip64 archives are not accepted";
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    if (name === "word/document.xml") documentXml = size;
    total += size;
    if (total > MAX_DOCX_UNCOMPRESSED) return "expands to more than 50 MB";
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (documentXml > MAX_DOCX_DOCUMENT_XML) return "document text is over 20 MB";
  return null;
}

