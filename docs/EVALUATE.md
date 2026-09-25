# Evaluate — flow, endpoints, limits

The EVALUATE feature takes a draft solicitation and returns a suitability
evaluation: comparable records, recipient concentration, a calibrated-language
review and a composite score, sealed with a proof token.

## Flow

1. **`/evaluate`** (`src/components/EvaluateForm.tsx`) — the user enters a
   working title, amount, department and fiscal year, then either **pastes**
   the draft into the textarea or **uploads a file** (`.txt`, `.md`, `.docx`,
   `.pdf`). An upload is POSTed to `/api/draft/extract`; the extracted text is
   placed in the textarea (still editable) with a status line showing the file
   name, kind and character count. The calibrated-language sweep runs client
   side as the text changes.
2. **Submit** → `POST /api/draft/evaluate` builds the `EvaluationResult`
   (`src/lib/evaluate/buildResult.ts`), persists it (`app.evaluations` via
   `src/lib/evaluate/store.ts`, memory cache in front) and returns the
   `evaluationId`. The submit button is disabled while the request is in
   flight, so a second click cannot create a second evaluation.
3. **`/evaluate/[evaluationId]`** (`src/components/evaluate/EvaluationView.tsx`)
   renders six sections. Two are specific to this doc:
   - **01 Suitability score** — `SuitabilityScoreCircle.tsx`: a 60-tick radial
     scale (every 10th tick taller) lit to `composite / 30`, four dimension
     arcs on one ring (each 0–10, drawn with an 80 ms stagger), the composite
     number in the centre and the caption *below* it. Hover an arc or legend
     row to read one dimension. `prefers-reduced-motion` collapses every
     animation to its final state.
   - **04 Calibrated language review** — `LanguageAuditView.tsx`: left, the
     **calibrated draft** with each change footnoted (toggle to *Original* to
     see the flagged phrases underlined with the validator's guidance on
     hover); right, the ordered **change list** — original → replacement,
     flag type, one-line reason — and the **Download calibrated draft
     (.docx)** button. Stacks to one column below `md`.

## How calibrated changes are derived

`src/lib/evaluate/calibrated.ts` is a pure function of
`(draftText, calibrationFlags)` used by both the page and the `.docx` route,
so the screen and the download never disagree.

- A flag becomes a **replace** or **remove** only when the calibrated
  accountability lexicon (`.claude/skills/calibrated-accountability-language-skill.md`,
  mirrored by `src/lib/gov/validators.ts`) documents a literal drop-in for the
  exact phrase — e.g. `failed to` → `did not, per public records,`,
  `clearly shows` → `indicates`, `stunning` → *(removed)*,
  `led to … grant` → `preceded … grant`.
- Anything else (`fraud`, `sources say`, `in exchange for`, reader-direction
  clauses, non-`CALIBRATION_LEAK` flag types, overlapping spans) is
  **manual**: the phrase is kept verbatim, marked amber, and the list repeats
  the validator's guidance. Nothing is invented.
- Tests: `src/lib/evaluate/__tests__/calibrated.test.ts`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/draft/evaluate` | JSON `DraftSubmission` → `{ evaluationId, proofId, verdict, composite }`. |
| `POST` | `/api/draft/extract` | `multipart/form-data` with one `file` field → `{ text, kind, chars, truncated, fileName }`. |
| `GET` | `/api/draft/<evaluationId>/calibrated.docx` | The calibrated draft as a Word document (see below). |

### `POST /api/draft/extract`

- Accepts `.txt`/`.md` (UTF-8), `.docx` (via `mammoth`), `.pdf` (via
  `unpdf`, text layer only — scanned PDFs return 422).
- Validates server side: size ≤ 5 MB (`413`), extension (`415`), and magic
  bytes — `PK\x03\x04` for docx, `%PDF` for pdf, no NUL bytes for text
  (`415`). Extraction failures return `422` with a plain-language message
  (for PDFs: "PDF extraction not available yet — paste the text").
- The file is read into memory, converted and discarded. It is never written
  to disk, stored, or executed.
- Text is normalised (line endings, control characters, blank runs) and cut
  at the 20 000-character draft limit; `truncated: true` tells the form to
  show a notice.
- `Cache-Control: private, no-store`.

### `GET /api/draft/<evaluationId>/calibrated.docx`

- Loads the evaluation from the store (`404` JSON for unknown ids).
- Returns `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  as an attachment (`calibrated-draft-<id>.docx`), `Cache-Control: private, no-store`.
- Contents: title, department, amount, fiscal year, date, verdict; the
  calibrated draft as paragraphs; a **Calibration changes** table
  (# / original / replacement / reason); footer with the evaluation id, proof
  id and `https://glassbox.pythagorithm.ai/verify/<proofId>`.
- Built with the `docx` package.

## Limits

| Limit | Value | Where |
|---|---|---|
| Draft text | 40 – 20 000 characters | `/api/draft/evaluate`, textarea `maxLength`, extract cap |
| Working title | ≤ 300 characters | `/api/draft/evaluate` |
| Evaluate JSON body | ≤ 256 KB | `/api/draft/evaluate` |
| Upload | ≤ 5 MB, `.txt .md .docx .pdf` | `/api/draft/extract` |
| Composite score | 0 – 30 (four 0 – 10 dimensions) | `SuitabilityScoreCircle` |

## Dependencies

`docx` (Word generation), `mammoth` (docx → text), `unpdf` (pdf → text).
`unpdf` runs pdfjs in-process; the route hands it the worker as a `data:`
URL built from `pdfjs-dist/legacy/build/pdf.worker.min.mjs`, because the
bundled route cannot resolve the worker from `.next/server/chunks`. If that
file is not present in a deployment, PDFs degrade to the 422 message above
and every other type still works. The robust production alternative is
`serverExternalPackages: ["unpdf", "pdfjs-dist"]` in `next.config.ts`.
