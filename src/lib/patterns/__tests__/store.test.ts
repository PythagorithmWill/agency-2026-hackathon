import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  hasAppTable: vi.fn(async () => false),
  query: vi.fn(),
  loadSnapshot: vi.fn(),
}));
vi.mock("../../db/features", () => ({
  hasAppTable: mocks.hasAppTable,
  forgetAppTable: vi.fn(),
  isUndefinedTable: (e: unknown) => (e as { code?: string })?.code === "42P01",
}));
vi.mock("../../db/pool", () => ({ query: mocks.query, longQuery: mocks.query }));
vi.mock("../../analytics/snapshot", () => ({ loadSnapshot: mocks.loadSnapshot }));

import { snapshotMatchToRow, rowToDetectorMatch, loadPatternMatches, loadPatternCounts, loadPatternFilters } from "../store";

const legacy = {
  patternId: "zombie-recipients",
  matchId: "zombie-recipients:123456789:1500000-2019-01-01",
  subject: { type: "recipient", id: "123456789", canonicalName: "OLD ORG" },
  evidence: [{ source: "fed.grants_contributions", rowId: "123456789", field: "total_value", value: 1_500_000 }],
  calibratedSummary: "The dataset shows …",
  signalStrength: "flag",
  detectedAt: "2026-09-24T00:00:00.000Z",
};
const v2 = {
  ...legacy,
  matchId: "zombie-recipients:999:1-2020-01-01",
  severity: "critical",
  signal: 8.2,
  evidenceStrength: 0.91,
  benignNote: "Some note",
  department: "Dept A",
  province: "ON",
  fiscalYear: 2020,
};

describe("store — snapshot mapping", () => {
  it("maps a legacy snapshot entry with defaults (strength 0.5, benignNote null, severity from signalStrength)", () => {
    const row = snapshotMatchToRow(legacy)!;
    expect(row.patternId).toBe("zombie-recipients");
    expect(row.severity).toBe("high"); // flag → high
    expect(row.evidenceStrength).toBe(0.5);
    expect(row.benignNote).toBeNull();
    expect(row.department).toBeNull();
    expect(row.fiscalYear).toBeNull();
    expect(row.signal).toBe(3); // severity rank stands in for a missing signal
    expect(row.computedAt).toBe(legacy.detectedAt);
    expect(row.evidence).toHaveLength(1);
  });

  it("keeps v2 fields when present", () => {
    const row = snapshotMatchToRow(v2)!;
    expect(row.severity).toBe("critical");
    expect(row.signal).toBe(8.2);
    expect(row.evidenceStrength).toBe(0.91);
    expect(row.benignNote).toBe("Some note");
    expect(row.department).toBe("Dept A");
    expect(row.province).toBe("ON");
    expect(row.fiscalYear).toBe(2020);
  });

  it("rejects malformed entries", () => {
    expect(snapshotMatchToRow(null)).toBeNull();
    expect(snapshotMatchToRow({ patternId: "x" })).toBeNull();
  });

  it("round-trips a row to the detector shape", () => {
    const m = rowToDetectorMatch(snapshotMatchToRow(v2)!);
    expect(m.signalStrength).toBe("flag");
    expect(m.severity).toBe("critical");
    expect(m.detectedAt).toBe(legacy.detectedAt);
  });
});

describe("store — snapshot fallback", () => {
  beforeEach(() => {
    mocks.hasAppTable.mockResolvedValue(false);
    mocks.loadSnapshot.mockResolvedValue({
      patternMatches: { "zombie-recipients": [legacy, v2], "ghost-capacity": [] },
    });
  });

  it("filters, sorts by signal and paginates", async () => {
    const all = await loadPatternMatches({ patternId: "zombie-recipients" });
    expect(all.source).toBe("snapshot");
    expect(all.total).toBe(2);
    expect(all.rows[0].matchId).toBe(v2.matchId); // higher signal first
    const filtered = await loadPatternMatches({ patternId: "zombie-recipients", department: "Dept A", minStrength: 0.9 });
    expect(filtered.rows.map((r) => r.matchId)).toEqual([v2.matchId]);
    const page = await loadPatternMatches({ patternId: "zombie-recipients", limit: 1, offset: 1 });
    expect(page.total).toBe(2);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0].matchId).toBe(legacy.matchId);
    const fy = await loadPatternMatches({ patternId: "zombie-recipients", fyFrom: 2021 });
    expect(fy.total).toBe(0);
  });

  it("counts and filters come from the snapshot", async () => {
    expect(await loadPatternCounts()).toEqual({ "zombie-recipients": 2, "ghost-capacity": 0 });
    expect(await loadPatternFilters("zombie-recipients")).toEqual({
      departments: ["Dept A"],
      provinces: ["ON"],
      fyRange: { min: 2020, max: 2020 },
    });
  });
});

describe("store — table path", () => {
  it("reads app.pattern_matches with filters and reports the window total", async () => {
    mocks.hasAppTable.mockResolvedValue(true);
    mocks.query.mockResolvedValue({
      rows: [
        {
          pattern_id: "ghost-capacity", match_id: "ghost-capacity:X", subject_type: "recipient", subject_id: "X",
          canonical_name: "X", severity: "medium", signal: "1500000", evidence: [], calibrated_summary: "s",
          evidence_strength: "0.640", benign_note: null, department: "D", province: null, fiscal_year: 2023,
          computed_at: new Date("2026-09-24T00:00:00Z"), total: "17",
        },
      ],
    });
    const r = await loadPatternMatches({ patternId: "ghost-capacity", department: "D", minStrength: 0.5, limit: 10 });
    expect(r.source).toBe("table");
    expect(r.total).toBe(17);
    expect(r.rows[0]).toMatchObject({ signal: 1_500_000, evidenceStrength: 0.64, department: "D", fiscalYear: 2023 });
    const sql = (mocks.query.mock.calls.at(-1) as unknown[])[0] as string;
    expect(sql).toMatch(/department = \$2/);
    expect(sql).toMatch(/evidence_strength >= \$3/);
  });
});
