import { NextResponse } from "next/server";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { loadEvaluation } from "@/lib/evaluate/store";
import { buildCalibratedDraft, describeAction } from "@/lib/evaluate/calibrated";
import type { EvaluationResult } from "@/lib/types";

export const dynamic = "force-dynamic";

// Must match metadataBase in src/app/layout.tsx and the proof download
// route — the bare pythagorithm.ai host has no /verify route.
const SITE_ORIGIN = "https://glassbox.pythagorithm.ai";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

/**
 * GET /api/draft/<evaluationId>/calibrated.docx
 *
 * Streams the calibrated draft as a real Word document: title block, the
 * calibrated text as paragraphs, a "Calibration changes" table (original /
 * replacement / reason) and a footer with the evaluation id, proof id and
 * verify URL. The text and table come from the same `buildCalibratedDraft`
 * the screen uses.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ evaluationId: string }> },
): Promise<Response> {
  // Route-handler params arrive already percent-decoded.
  const { evaluationId } = await context.params;
  const result = await loadEvaluation(evaluationId);
  if (!result) {
    return NextResponse.json(
      { error: "evaluation not found", evaluationId },
      { status: 404, headers: NO_STORE },
    );
  }

  let buffer: Buffer;
  try {
    buffer = await Packer.toBuffer(buildDocument(result));
  } catch (err) {
    console.error("[api/draft/calibrated.docx] build failed:", (err as Error).message);
    return NextResponse.json({ error: "document_build_failed" }, { status: 500, headers: NO_STORE });
  }

  const safeId = result.evaluationId.replace(/[^A-Za-z0-9._-]+/g, "_");
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="calibrated-draft-${safeId}.docx"`,
      "Content-Length": String(buffer.byteLength),
      ...NO_STORE,
    },
  });
}

const FONT = "Calibri";
const MUTED = "6B6B70";
const ACCENT = "0F766E"; // print-safe teal (the screen accent is too light on paper)
const AMBER = "B45309";

function buildDocument(result: EvaluationResult): Document {
  const { submission, proofToken } = result;
  const calibrated = buildCalibratedDraft(submission.draftText, result.calibrationFlags);
  const verifyUrl = `${SITE_ORIGIN}/verify/${proofToken.proofId}`;
  const date = result.createdAt.slice(0, 10);

  const meta = (label: string, value: string) =>
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: `${label}  `, font: FONT, size: 18, color: MUTED, allCaps: true }),
        new TextRun({ text: value, font: FONT, size: 20 }),
      ],
    });

  const draftParagraphs = calibrated.text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p.length > 0)
    .map(
      (p) =>
        new Paragraph({
          spacing: { after: 160, line: 300 },
          children: [new TextRun({ text: p, font: FONT, size: 22 })],
        }),
    );

  const changeRows = calibrated.changes.map(
    (c) =>
      new TableRow({
        children: [
          cell(String(c.n), { width: 6, align: AlignmentType.CENTER }),
          cell(c.original, { width: 28, strike: true, color: MUTED }),
          cell(
            c.action === "replace"
              ? (c.replacement ?? "")
              : c.action === "remove"
                ? "(removed)"
                : "(kept — rewrite by hand)",
            { width: 28, color: c.action === "manual" ? AMBER : ACCENT, italics: c.action !== "replace" },
          ),
          cell(
            `${c.type.replace(/_/g, " ")} · ${describeAction(c)}. ${c.reason}` +
              (c.action === "manual" && c.guidance ? ` Validator: ${c.guidance}` : ""),
            { width: 38 },
          ),
        ],
      }),
  );

  const changesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cell("#", { width: 6, header: true, align: AlignmentType.CENTER }),
          cell("Original", { width: 28, header: true }),
          cell("Replacement", { width: 28, header: true }),
          cell("Reason", { width: 38, header: true }),
        ],
      }),
      ...changeRows,
    ],
  });

  const noChanges = new Paragraph({
    spacing: { after: 160 },
    children: [
      new TextRun({
        text: "No calibration flags — the draft passed the calibrated-language gate unchanged.",
        font: FONT,
        size: 20,
        italics: true,
        color: MUTED,
      }),
    ],
  });

  const footerLine = (text: string) =>
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({ text, font: FONT, size: 15, color: MUTED })],
    });

  return new Document({
    creator: "Glassbox",
    title: `Calibrated draft — ${submission.workingTitle}`,
    description: `Calibrated draft for evaluation ${result.evaluationId}`,
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } },
        },
        footers: {
          default: new Footer({
            children: [
              footerLine(`Evaluation ${result.evaluationId} · Proof ${proofToken.proofId}`),
              footerLine(`Verify: ${verifyUrl}`),
              footerLine(
                "Glassbox · built on the Pythagorithm Proof Methodology. Observations from public records; the reader draws the conclusion.",
              ),
            ],
          }),
        },
        children: [
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: "GLASSBOX · CALIBRATED DRAFT", font: FONT, size: 16, color: ACCENT, bold: true }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.TITLE,
            spacing: { after: 200 },
            children: [new TextRun({ text: submission.workingTitle, font: FONT, size: 44, bold: true })],
          }),
          meta("Department", submission.awardingDepartment),
          meta("Anticipated amount", cad.format(submission.anticipatedAmount)),
          meta("Fiscal year", `FY${submission.anticipatedFiscalYear}`),
          meta("Date", date),
          meta("Verdict", `${result.suitability.verdict} · ${result.suitability.composite}/30`),
          rule(),
          heading("Calibrated draft"),
          ...(draftParagraphs.length > 0 ? draftParagraphs : [noChanges]),
          rule(),
          heading(`Calibration changes (${calibrated.changes.length})`),
          ...(calibrated.changes.length > 0 ? [changesTable] : [noChanges]),
          new Paragraph({ spacing: { before: 200 }, children: [] }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Replacements come from the calibrated-accountability lexicon; phrases marked “kept” have no documented drop-in and need a human rewrite. Nothing else in the draft was altered.",
                font: FONT,
                size: 18,
                color: MUTED,
              }),
            ],
          }),
        ],
      },
    ],
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 26, bold: true })],
  });
}

function rule(): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D4D4D8", space: 1 } },
    children: [],
  });
}

function cell(
  text: string,
  opts: {
    width: number;
    header?: boolean;
    strike?: boolean;
    italics?: boolean;
    color?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  },
): TableCell {
  return new TableCell({
    width: { size: opts.width, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    shading: opts.header ? { type: ShadingType.CLEAR, fill: "F4F4F5", color: "auto" } : undefined,
    children: [
      new Paragraph({
        alignment: opts.align,
        children: [
          new TextRun({
            text,
            font: FONT,
            size: opts.header ? 17 : 18,
            bold: opts.header,
            strike: opts.strike,
            italics: opts.italics,
            color: opts.color,
            allCaps: opts.header,
          }),
        ],
      }),
    ],
  });
}
