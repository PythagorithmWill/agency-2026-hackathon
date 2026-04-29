import type { ComparableRecord, AwardeeConcentration } from "../types";
import { computeHHI } from "../suitability/engine";

/**
 * Deterministic mock comparable-record generator. Used by /api/draft/evaluate
 * while the embedding job populates the corpus. Once the corpus has live
 * embeddings, this is replaced by hybrid retrieval against pgvector.
 *
 * The mock is keyed on the SHA-1 of the draft text + working title so each
 * draft gets a stable, distinct set of comparables across reloads.
 */

const BASE_RECORDS: Omit<ComparableRecord, "similarity" | "retrievalReason">[] = [
  {
    recordId: "fed-2024-isi-2381",
    sourceDataset: "fed",
    recipientLegalName: "NorthLink Communications Cooperative",
    recipientBn: "812995041",
    recipientProvince: "MB",
    awardingDept: "Innovation, Science and Economic Development Canada",
    programCode: "Universal Broadband Fund",
    fiscalYear: 2024,
    agreementValue: 4_300_000,
    description:
      "Federal contribution to extend fixed-wireless broadband infrastructure across 14 northern Manitoba communities, including last-mile residential coverage and three new transmitter sites.",
  },
  {
    recordId: "fed-2025-isi-3019",
    sourceDataset: "fed",
    recipientLegalName: "Boreal Wireless Inc.",
    recipientBn: "846228301",
    recipientProvince: "ON",
    awardingDept: "Innovation, Science and Economic Development Canada",
    programCode: "Universal Broadband Fund",
    fiscalYear: 2025,
    agreementValue: 3_900_000,
    description:
      "Contribution to deploy fixed-wireless broadband and middle-mile fibre across Northwestern Ontario, with First Nation co-management on five sites.",
  },
  {
    recordId: "fed-2024-isi-2102",
    sourceDataset: "fed",
    recipientLegalName: "Atlantic Connectivity Authority",
    recipientBn: "846124390",
    recipientProvince: "NS",
    awardingDept: "Innovation, Science and Economic Development Canada",
    programCode: "Connect to Innovate",
    fiscalYear: 2024,
    agreementValue: 4_500_000,
    description:
      "Federal contribution to expand broadband to under-served Maritime communities under the Connect to Innovate program with 50/10 Mbps service-level commitment.",
  },
  {
    recordId: "fed-2023-isi-1842",
    sourceDataset: "fed",
    recipientLegalName: "TerraNet Cooperative",
    recipientBn: "893408519",
    recipientProvince: "QC",
    awardingDept: "Innovation, Science and Economic Development Canada",
    programCode: "Universal Broadband Fund",
    fiscalYear: 2023,
    agreementValue: 4_100_000,
    description:
      "Funding for a regional cooperative to extend wireline broadband to rural Quebec municipalities; includes Indigenous community partnership in the Eastern Townships.",
  },
  {
    recordId: "fed-2025-nrc-0921",
    sourceDataset: "fed",
    recipientLegalName: "Polar Wireless Networks",
    recipientBn: "118810988",
    recipientProvince: "YT",
    awardingDept: "Crown-Indigenous Relations and Northern Affairs Canada",
    programCode: "Northern REACHE",
    fiscalYear: 2025,
    agreementValue: 5_100_000,
    description:
      "Federal contribution to a Yukon Indigenous-owned telecom for satellite-backhaul deployment supporting six off-grid communities.",
  },
  {
    recordId: "ab-2024-grant-7123",
    sourceDataset: "ab_grants",
    recipientLegalName: "RuralAB Connectivity Society",
    recipientBn: null,
    recipientProvince: "AB",
    awardingDept: "Service Alberta and Red Tape Reduction",
    programCode: "Rural Connectivity Initiative",
    fiscalYear: 2024,
    agreementValue: 3_700_000,
    description:
      "Provincial grant supporting fixed-wireless tower buildout across rural southern Alberta with municipal cost-sharing.",
  },
  {
    recordId: "fed-2024-isi-2502",
    sourceDataset: "fed",
    recipientLegalName: "NorthLink Communications Cooperative",
    recipientBn: "812995041",
    recipientProvince: "MB",
    awardingDept: "Innovation, Science and Economic Development Canada",
    programCode: "Universal Broadband Fund",
    fiscalYear: 2025,
    agreementValue: 2_800_000,
    description:
      "Amendment funding to extend the FY2024 Manitoba broadband expansion to four additional communities; same recipient, same program family.",
  },
  {
    recordId: "fed-2022-isi-1551",
    sourceDataset: "fed",
    recipientLegalName: "Praxis Communications",
    recipientBn: "846239155",
    recipientProvince: "BC",
    awardingDept: "Innovation, Science and Economic Development Canada",
    programCode: "Connect to Innovate",
    fiscalYear: 2022,
    agreementValue: 3_400_000,
    description:
      "Earlier-program contribution for fibre middle-mile and broadband last-mile in interior British Columbia with First Nations partnership terms.",
  },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function generateMockComparables(
  draftText: string,
  workingTitle: string,
): ComparableRecord[] {
  const seed = hash(`${workingTitle}|${draftText.slice(0, 200)}`);
  return BASE_RECORDS.map((r, i) => {
    // Deterministic similarity: higher when the draft mentions broadband
    // / connectivity / wireless / north / community keywords.
    const draftLower = draftText.toLowerCase();
    let s = 0.4;
    const keywords = [
      "broadband",
      "wireless",
      "connectivity",
      "fibre",
      "fiber",
      "internet",
      "rural",
      "north",
      "community",
      "indigenous",
    ];
    for (const k of keywords) if (draftLower.includes(k)) s += 0.06;
    // Per-record variance keyed on hash + index
    const variance = ((seed >> ((i * 3) % 30)) & 0xff) / 1280;
    s = Math.max(0.25, Math.min(0.95, s + variance - 0.1));
    return { ...r, similarity: s, retrievalReason: "hybrid" as const };
  }).sort((a, b) => b.similarity - a.similarity);
}

export function buildAwardeeConcentration(
  records: ComparableRecord[],
): AwardeeConcentration {
  const byRecipient = new Map<string, { totalAwarded: number; awardCount: number; bn: string | null }>();
  for (const r of records) {
    const key = r.recipientLegalName;
    const cur = byRecipient.get(key) ?? { totalAwarded: 0, awardCount: 0, bn: r.recipientBn };
    cur.totalAwarded += r.agreementValue;
    cur.awardCount += 1;
    byRecipient.set(key, cur);
  }
  const rows = Array.from(byRecipient.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.totalAwarded - a.totalAwarded);
  const total = rows.reduce((s, r) => s + r.totalAwarded, 0) || 1;
  const top = rows.slice(0, 5).map((r) => ({
    name: r.name,
    bn: r.bn,
    totalAwarded: r.totalAwarded,
    awardCount: r.awardCount,
    share: r.totalAwarded / total,
  }));
  const hhi = computeHHI(rows);

  const dollar = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  const observation =
    rows.length === 0
      ? "The dataset returned no comparable records for this draft."
      : `Across the ${records.length} comparable records, ${top.length} recipients account for ${(top.reduce((s, r) => s + r.share, 0) * 100).toFixed(0)}% of total dollar volume awarded. The recipient with the largest share is ${top[0]?.name}, with ${top[0]?.awardCount} award${top[0]?.awardCount === 1 ? "" : "s"} totaling ${dollar.format(top[0]?.totalAwarded ?? 0)}.`;

  const citations = records.slice(0, 3).map((r) => r.recordId);
  return { topRecipients: top, hhi, observation, citations };
}
