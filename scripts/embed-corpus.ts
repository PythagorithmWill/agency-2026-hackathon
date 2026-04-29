/**
 * Embedding job — curates the corpus and populates the embedding column.
 * Runs in background from session start; the UI degrades gracefully to
 * keyword-only retrieval until ≥10K records are embedded.
 *
 * Provider chain: Voyage AI voyage-3-large primary → OpenAI
 * text-embedding-3-large → Cohere embed-english-v3 via Bedrock.
 *
 * Writes back to a SEPARATE writable Postgres instance — PROJECT-RULES R2
 * forbids writes to the read-only hackathon DB. EMBEDDING_DATABASE_URL
 * points at the writable instance.
 *
 * Progress: every 5,000 records embedded, append a line to PROGRESS.md.
 *
 * Usage: npm run embed
 */
import { Pool } from "pg";
import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_URL = process.env.DATABASE_URL;
const TARGET_URL = process.env.EMBEDDING_DATABASE_URL;
const PROVIDER = (process.env.EMBEDDING_PROVIDER ?? "voyage").toLowerCase();
const BATCH_SIZE = 128;
const TOKEN_LIMIT = 8000;

if (!SOURCE_URL || !TARGET_URL) {
  console.error("DATABASE_URL and EMBEDDING_DATABASE_URL are required");
  process.exit(1);
}

const sourcePool = new Pool({
  connectionString: SOURCE_URL,
  ssl: SOURCE_URL.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  max: 4,
  query_timeout: 120_000,
});
const targetPool = new Pool({ connectionString: TARGET_URL, max: 4 });

interface CorpusRow {
  source_dataset: "fed" | "ab_grants" | "ab_contracts";
  record_id: string;
  awarding_dept: string;
  recipient_legal_name: string;
  recipient_bn: string | null;
  recipient_province: string | null;
  program_code: string | null;
  agreement_value: number;
  fiscal_year_start: string;
  fiscal_year_end: string | null;
  description: string;
}

async function ensureSchema() {
  await targetPool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
  await targetPool.query(`
    CREATE TABLE IF NOT EXISTS corpus (
      source_dataset       TEXT NOT NULL,
      record_id            TEXT NOT NULL,
      awarding_dept        TEXT NOT NULL,
      recipient_legal_name TEXT NOT NULL,
      recipient_bn         TEXT,
      recipient_province   TEXT,
      program_code         TEXT,
      agreement_value      NUMERIC NOT NULL,
      fiscal_year_start    DATE,
      fiscal_year_end      DATE,
      description          TEXT NOT NULL,
      embedding            vector(1024),
      retrieved_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (source_dataset, record_id)
    )
  `);
  await targetPool.query(`
    CREATE INDEX IF NOT EXISTS corpus_embedding_hnsw
      ON corpus USING hnsw (embedding vector_cosine_ops)
  `);
  await targetPool.query(`
    CREATE INDEX IF NOT EXISTS corpus_description_trgm
      ON corpus USING gin (description gin_trgm_ops)
  `);
}

async function curateAndStage(): Promise<number> {
  console.log("Curating corpus from source DB…");
  const fedSql = `
    WITH agreement_current AS (
      SELECT DISTINCT ON (
        ref_number,
        COALESCE(recipient_business_number, recipient_legal_name, _id::text)
      )
        _id, ref_number, recipient_legal_name, recipient_business_number,
        recipient_province, owner_org_title, prog_name_en,
        agreement_value, agreement_start_date, agreement_end_date,
        description_en
      FROM fed.grants_contributions
      ORDER BY ref_number,
               COALESCE(recipient_business_number, recipient_legal_name, _id::text),
               NULLIF(amendment_number, '')::int DESC NULLS LAST,
               _id DESC
    )
    SELECT
      'fed' AS source_dataset,
      ref_number AS record_id,
      owner_org_title AS awarding_dept,
      recipient_legal_name,
      recipient_business_number AS recipient_bn,
      recipient_province,
      prog_name_en AS program_code,
      agreement_value,
      agreement_start_date AS fiscal_year_start,
      agreement_end_date AS fiscal_year_end,
      description_en AS description
    FROM agreement_current
    WHERE description_en IS NOT NULL
      AND length(description_en) >= 80
  `;
  const abSql = `
    SELECT
      'ab_grants' AS source_dataset,
      id::text AS record_id,
      ministry AS awarding_dept,
      recipient AS recipient_legal_name,
      NULL AS recipient_bn,
      NULL AS recipient_province,
      program AS program_code,
      amount AS agreement_value,
      payment_date AS fiscal_year_start,
      NULL AS fiscal_year_end,
      description
    FROM ab.ab_grants
    WHERE recipient IS NOT NULL
      AND description IS NOT NULL
      AND length(description) >= 80
  `;

  let total = 0;
  for (const sql of [fedSql, abSql]) {
    let cur = sourcePool.query<CorpusRow>(sql);
    const r = await cur;
    for (let i = 0; i < r.rows.length; i += BATCH_SIZE) {
      const batch = r.rows.slice(i, i + BATCH_SIZE);
      await stageBatch(batch);
      total += batch.length;
      if (total % 5000 < BATCH_SIZE) {
        await logProgress(`Staged ${total.toLocaleString()} corpus rows`);
      }
    }
  }
  return total;
}

async function stageBatch(batch: CorpusRow[]): Promise<void> {
  if (batch.length === 0) return;
  const placeholders = batch
    .map((_, i) => {
      const o = i * 11;
      return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9}, $${o + 10}, $${o + 11})`;
    })
    .join(", ");
  const params: unknown[] = [];
  for (const r of batch) {
    params.push(
      r.source_dataset,
      r.record_id,
      r.awarding_dept,
      r.recipient_legal_name,
      r.recipient_bn,
      r.recipient_province,
      r.program_code,
      r.agreement_value,
      r.fiscal_year_start,
      r.fiscal_year_end,
      r.description.slice(0, 32_000),
    );
  }
  await targetPool.query(
    `INSERT INTO corpus (source_dataset, record_id, awarding_dept, recipient_legal_name, recipient_bn, recipient_province, program_code, agreement_value, fiscal_year_start, fiscal_year_end, description)
     VALUES ${placeholders}
     ON CONFLICT (source_dataset, record_id) DO UPDATE SET
       awarding_dept        = EXCLUDED.awarding_dept,
       recipient_legal_name = EXCLUDED.recipient_legal_name,
       recipient_bn         = EXCLUDED.recipient_bn,
       recipient_province   = EXCLUDED.recipient_province,
       program_code         = EXCLUDED.program_code,
       agreement_value      = EXCLUDED.agreement_value,
       fiscal_year_start    = EXCLUDED.fiscal_year_start,
       fiscal_year_end      = EXCLUDED.fiscal_year_end,
       description          = EXCLUDED.description
    `,
    params,
  );
}

async function embedPending(): Promise<number> {
  console.log(`Embedding via provider: ${PROVIDER}`);
  let embedded = 0;
  for (;;) {
    const batch = await targetPool.query<{ source_dataset: string; record_id: string; description: string }>(
      `SELECT source_dataset, record_id, description
         FROM corpus
        WHERE embedding IS NULL
        ORDER BY retrieved_at
        LIMIT $1`,
      [BATCH_SIZE],
    );
    if (batch.rows.length === 0) break;

    const texts = batch.rows.map((r) => r.description.slice(0, TOKEN_LIMIT * 4));
    const vectors = await embedTexts(texts);

    for (let i = 0; i < batch.rows.length; i++) {
      const r = batch.rows[i];
      const v = vectors[i];
      if (!v) continue;
      const literal = `[${v.join(",")}]`;
      await targetPool.query(
        `UPDATE corpus
            SET embedding = $1::vector
          WHERE source_dataset = $2 AND record_id = $3`,
        [literal, r.source_dataset, r.record_id],
      );
    }
    embedded += batch.rows.length;
    if (embedded % 5_000 < BATCH_SIZE) {
      await logProgress(`Embedded ${embedded.toLocaleString()} records (provider: ${PROVIDER})`);
    }
  }
  return embedded;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  if (PROVIDER === "voyage") return embedVoyage(texts);
  if (PROVIDER === "openai") return embedOpenAI(texts);
  throw new Error(`Unknown provider: ${PROVIDER}`);
}

async function embedVoyage(texts: string[]): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY not set");
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: texts, model: process.env.EMBEDDING_MODEL ?? "voyage-3-large", input_type: "document" }),
  });
  if (!res.ok) throw new Error(`Voyage embed failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ input: texts, model: "text-embedding-3-large", dimensions: 1024 }),
  });
  if (!res.ok) throw new Error(`OpenAI embed failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

async function logProgress(msg: string): Promise<void> {
  const stamp = new Date().toISOString();
  const line = `\n## [${stamp.slice(0, 19)}] embed-corpus\n\n- ${msg}\n`;
  await fs.appendFile(path.join(process.cwd(), "PROGRESS.md"), line, "utf8").catch(() => {});
  console.log(`[${stamp.slice(11, 19)}] ${msg}`);
}

async function main(): Promise<void> {
  await ensureSchema();
  await logProgress("Schema ready (corpus table + HNSW index)");
  const staged = await curateAndStage();
  await logProgress(`Total staged: ${staged.toLocaleString()}`);
  const embedded = await embedPending();
  await logProgress(`Total embedded: ${embedded.toLocaleString()}`);
  await sourcePool.end();
  await targetPool.end();
}

main().catch(async (err) => {
  console.error(err);
  await logProgress(`embed-corpus failed: ${(err as Error).message}`);
  process.exit(1);
});
