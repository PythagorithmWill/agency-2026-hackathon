import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { docxProblem, MAX_DOCX_DOCUMENT_XML } from "../evaluate/upload-guards";
import { decodeParam } from "../params";
import { isSameOrigin } from "../sameOrigin";
import { isPlausibleId, newEvaluationId, newProofId } from "../proof";

/** Minimal ZIP writer: stored/deflated entries with honest or forged uncompressed sizes. */
function zip(entries: { name: string; data: Buffer; claimSize?: number }[]): Uint8Array {
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name);
    const comp = deflateRawSync(e.data);
    const size = e.claimSize ?? e.data.length;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(size, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(size, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, comp); centrals.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, eocd]));
}

describe("docx zip-bomb guard", () => {
  it("accepts an ordinary document", () => {
    expect(docxProblem(zip([{ name: "[Content_Types].xml", data: Buffer.from("<x/>") }, { name: "word/document.xml", data: Buffer.from("<w:document/>") }]))).toBeNull();
  });
  it("refuses a document.xml that expands past the cap", () => {
    expect(docxProblem(zip([{ name: "word/document.xml", data: Buffer.from("a"), claimSize: MAX_DOCX_DOCUMENT_XML + 1 }]))).toMatch(/over 20 MB/);
  });
  it("refuses archives that expand past 50 MB in total", () => {
    const parts = Array.from({ length: 3 }, (_, i) => ({ name: `word/media/${i}.bin`, data: Buffer.from("a"), claimSize: 20 * 1024 * 1024 }));
    expect(docxProblem(zip(parts))).toMatch(/50 MB/);
  });
  it("refuses zip64 markers and non-zips", () => {
    expect(docxProblem(zip([{ name: "word/document.xml", data: Buffer.from("a"), claimSize: 0xffffffff }]))).toMatch(/zip64/);
    expect(docxProblem(new Uint8Array(Buffer.from("PK\x03\x04 not really a zip")))).toBe("not a valid zip");
  });
});

describe("decodeParam", () => {
  it("decodes normal segments and returns null for malformed ones", () => {
    expect(decodeParam("CONT_AWD_36C%20X")).toBe("CONT_AWD_36C X");
    expect(decodeParam("%")).toBeNull();
    expect(decodeParam("%E0%A4%A")).toBeNull();
  });
});

describe("isSameOrigin", () => {
  // Node's Request drops the browser-restricted Origin header, so build the shape directly.
  const req = (origin?: string) => ({
    url: "https://glassbox.pythagorithm.ai/api/draft/evaluate",
    headers: new Map([["host", "glassbox.pythagorithm.ai"], ...(origin ? [["origin", origin] as [string, string]] : [])]),
  }) as unknown as Request;
  it("allows same-site and origin-less requests, refuses other sites", () => {
    expect(isSameOrigin(req("https://glassbox.pythagorithm.ai"))).toBe(true);
    expect(isSameOrigin(req())).toBe(true);
    expect(isSameOrigin(req("https://evil.example"))).toBe(false);
    expect(isSameOrigin(req("null"))).toBe(false);
  });
});

describe("evaluation and proof IDs", () => {
  it("are random, independent and URL-safe", () => {
    const a = newEvaluationId(), b = newEvaluationId(), p = newProofId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^ev-[A-Za-z0-9_-]{22}$/);
    expect(p).toMatch(/^pf-[A-Za-z0-9_-]{22}$/);
    expect(p.includes(a.slice(3))).toBe(false);
    expect(isPlausibleId(a) && isPlausibleId(p) && isPlausibleId("ppm-2026-09-27T12:00:00.000Z-abc123-eval")).toBe(true);
    expect(isPlausibleId("../../etc/passwd")).toBe(false);
  });
});
