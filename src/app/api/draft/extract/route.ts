import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { docxProblem } from "@/lib/evaluate/upload-guards";
import { isSameOrigin } from "@/lib/sameOrigin";

export const dynamic = "force-dynamic";

/**
 * POST /api/draft/extract — multipart form with one `file` field.
 *
 * Turns an uploaded draft (.txt, .md, .docx, .pdf) into plain text for the
 * evaluate form's textarea. The body is read with a hard byte cap; the file
 * is validated by size, extension AND magic bytes; a .docx's zip directory is
 * checked for decompression bombs before it is opened; a PDF's page count is
 * checked before text extraction; extraction has a 10-second limit. Nothing
 * is written to disk or the database, nothing is executed.
 *
 * Response: { text, kind, chars, truncated, fileName }
 *   - `chars` is the length of the returned text.
 *   - `truncated` is true when the text was cut at the draft limit.
 */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Whole request body: the file plus multipart framing. */
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 16 * 1024;
/** PDF guard: page count, checked before any text is extracted. */
const MAX_PDF_PAGES = 200;
/** Wall-clock limit on any single extraction. */
const EXTRACT_TIMEOUT_MS = 10_000;
/** Mirrors MAX_DRAFT_LENGTH in ./evaluate/route.ts. */
const MAX_DRAFT_LENGTH = 20_000;

type ExtractKind = "txt" | "md" | "docx" | "pdf";

const KIND_BY_EXT: Record<string, ExtractKind> = {
  txt: "txt",
  md: "md",
  markdown: "md",
  docx: "docx",
  pdf: "pdf",
};

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function bad(error: string, status = 400): Response {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return bad("cross-site request refused", 403);
  const declared = Number(request.headers.get("content-length"));
  // Multipart framing adds a few hundred bytes; allow a small margin.
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return bad(`file exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`, 413);
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return bad("expected multipart/form-data with a `file` field");
  }

  // Read the body with a hard byte cap: Content-Length is optional (chunked
  // uploads) and never trusted on its own.
  const body = await readCapped(request, MAX_BODY_BYTES);
  if (body === "too-large") return bad(`file exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`, 413);
  if (body === null) return bad("expected multipart/form-data with a `file` field");

  let form: FormData;
  try {
    form = await new Response(new Blob([Buffer.from(body)]), { headers: { "content-type": contentType } }).formData();
  } catch {
    return bad("expected multipart/form-data with a `file` field");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return bad("missing `file` field");
  if (file.size === 0) return bad("the file is empty");
  if (file.size > MAX_UPLOAD_BYTES) {
    return bad(`file exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`, 413);
  }

  const fileName = (file.name || "draft").slice(0, 200);
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const kind = KIND_BY_EXT[ext];
  if (!kind) return bad("unsupported file type — upload .txt, .md, .docx or .pdf", 415);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!magicMatches(kind, bytes)) {
    return bad(`the file does not look like a ${ext} file`, 415);
  }

  if (kind === "docx") {
    const problem = docxProblem(bytes);
    if (problem) return bad(`could not read the docx file (${problem}) — paste the text instead`, 422);
  }

  let text: string;
  try {
    text = await withTimeout(extractText(kind, bytes), EXTRACT_TIMEOUT_MS);
  } catch (err) {
    const message = (err as Error).message;
    if (message === "extract-timeout") return bad("the file took too long to read — paste the text instead", 422);
    if (message === "pdf-too-long") return bad(`the PDF has more than ${MAX_PDF_PAGES} pages — paste the relevant text instead`, 422);
    console.warn(`[api/draft/extract] ${kind} extraction failed:`, message);
    if (kind === "pdf") {
      return bad("PDF extraction not available yet — paste the text", 422);
    }
    return bad(`could not read the ${ext} file — paste the text instead`, 422);
  }

  text = normalise(text);
  if (text.length === 0) {
    return bad(
      kind === "pdf"
        ? "no text layer found in the PDF (scanned image?) — paste the text"
        : "no text found in the file — paste the text instead",
      422,
    );
  }

  const truncated = text.length > MAX_DRAFT_LENGTH;
  if (truncated) text = text.slice(0, MAX_DRAFT_LENGTH);

  return NextResponse.json(
    { text, kind, chars: text.length, truncated, fileName },
    { headers: NO_STORE },
  );
}

function magicMatches(kind: ExtractKind, b: Uint8Array): boolean {
  switch (kind) {
    case "docx":
      // OOXML is a ZIP: "PK\x03\x04"
      return b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
    case "pdf":
      // "%PDF" within the first 1 KiB (some writers prepend junk)
      return indexOfAscii(b.subarray(0, 1024), "%PDF") >= 0;
    case "txt":
    case "md":
      // Reject binaries masquerading as text: any NUL in the first 8 KiB.
      return !b.subarray(0, 8192).includes(0);
  }
}

function indexOfAscii(b: Uint8Array, needle: string): number {
  outer: for (let i = 0; i + needle.length <= b.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (b[i + j] !== needle.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
}

async function extractText(kind: ExtractKind, bytes: Uint8Array): Promise<string> {
  switch (kind) {
    case "txt":
    case "md":
      return new TextDecoder("utf-8", { ignoreBOM: false }).decode(bytes);
    case "docx": {
      const r = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return r.value;
    }
    case "pdf": {
      // unpdf: a serverless-oriented pdfjs build that needs neither a worker
      // file nor a native canvas binding. (pdf-parse + pdfjs worker failed on
      // the Amplify runtime with "DOMMatrix is not defined" / worker lookup.)
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      if (pdf.numPages > MAX_PDF_PAGES) throw new Error("pdf-too-long");
      const { text } = await extractText(pdf, { mergePages: true });
      return String(text ?? "");
    }
  }
}


/** Read a request body, stopping as soon as it exceeds `max` bytes. */
async function readCapped(request: Request, max: number): Promise<Uint8Array | "too-large" | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return "too-large";
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("extract-timeout")), ms); });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Normalise line endings, strip control characters, collapse blank runs. */
function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
