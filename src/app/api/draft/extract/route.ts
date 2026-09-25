import { NextResponse } from "next/server";
import mammoth from "mammoth";

export const dynamic = "force-dynamic";

/**
 * POST /api/draft/extract — multipart form with one `file` field.
 *
 * Turns an uploaded draft (.txt, .md, .docx, .pdf) into plain text for the
 * evaluate form's textarea. The file is validated by size, extension AND
 * magic bytes, read once into memory, converted, and discarded — nothing is
 * written to disk or the database, nothing is executed.
 *
 * Response: { text, kind, chars, truncated, fileName }
 *   - `chars` is the length of the returned text.
 *   - `truncated` is true when the text was cut at the draft limit.
 */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
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
  const declared = Number(request.headers.get("content-length"));
  // Multipart framing adds a few hundred bytes; allow a small margin.
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + 16 * 1024) {
    return bad(`file exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
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

  let text: string;
  try {
    text = await extractText(kind, bytes);
  } catch (err) {
    const message = (err as Error).message;
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
      const { extractText } = await import("unpdf");
      const { text } = await extractText(new Uint8Array(bytes), { mergePages: true });
      return String(text ?? "");
    }
  }
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
