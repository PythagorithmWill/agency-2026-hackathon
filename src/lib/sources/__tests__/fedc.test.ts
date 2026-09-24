import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
vi.mock("../../db/pool", () => ({ query: (...a: unknown[]) => queryMock(...a) }));

import { amendmentGrowthByVendor, contractsByVendor, soleSourceShareByDepartment, vendorConcentrationByDepartment } from "../fedc";
import { resetSchemaCache } from "../schema";

function tableExists(exists: boolean) {
  queryMock.mockImplementationOnce(async () => ({ rows: [{ reg: exists ? "fedc.contracts" : null }] }));
}

beforeEach(() => {
  queryMock.mockReset();
  resetSchemaCache();
});

describe("fedc helpers — schema feature detection", () => {
  it("returns available:false without querying data when the table is absent", async () => {
    tableExists(false);
    const r = await contractsByVendor("Bell Canada");
    expect(r).toEqual({ available: false, rows: [] });
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toMatch(/to_regclass/);
  });

  it("returns available:false for an empty or invalid argument without touching the DB", async () => {
    expect(await contractsByVendor("   ")).toEqual({ available: false, rows: [] });
    expect(await soleSourceShareByDepartment("not-a-year")).toEqual({ available: false, rows: [] });
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("contractsByVendor", () => {
  it("normalises the vendor name and coerces numeric columns", async () => {
    tableExists(true);
    queryMock.mockImplementationOnce(async () => ({
      rows: [{ owner_org: "pwgsc-tpsgc", procurement_key: "X1", reference_number: "C-1", vendor_name: "Bell Canada", current_value: "123.45", original_value: null, number_of_bids: "3" }],
    }));
    const r = await contractsByVendor("  bell   canada ", { limit: 10 });
    expect(r.available).toBe(true);
    expect(queryMock.mock.calls[1][1]).toEqual(["BELL CANADA", 10]);
    expect(queryMock.mock.calls[1][0]).toMatch(/vendor_name_norm = \$1/);
    expect(r.rows[0].current_value).toBe(123.45);
    expect(r.rows[0].original_value).toBeNull();
    expect(r.rows[0].number_of_bids).toBe(3);
  });

  it("uses a contains match in fuzzy mode and clamps the limit", async () => {
    tableExists(true);
    queryMock.mockImplementationOnce(async () => ({ rows: [] }));
    await contractsByVendor("bell", { fuzzy: true, limit: 999_999 });
    expect(queryMock.mock.calls[1][0]).toMatch(/LIKE '%' \|\| \$1 \|\| '%'/);
    expect(queryMock.mock.calls[1][1]).toEqual(["BELL", 5000]);
  });
});

describe("soleSourceShareByDepartment", () => {
  it("accepts short fiscal-year labels and computes shares", async () => {
    tableExists(true);
    queryMock.mockImplementationOnce(async () => ({
      rows: [{ owner_org: "dnd-mdn", owner_org_title: "DND", fiscal_year: "2023-2024", contracts: 200, sole_source_contracts: 50, total_value: "1000", sole_source_value: "250" }],
    }));
    const r = await soleSourceShareByDepartment("2023-24");
    expect(queryMock.mock.calls[1][1]).toEqual(["2023-2024", 20]);
    expect(r.rows[0].sole_source_share_count).toBeCloseTo(0.25);
    expect(r.rows[0].sole_source_share_value).toBeCloseTo(0.25);
    expect(r.rows[0].total_value).toBe(1000);
  });

  it("guards division by zero", async () => {
    tableExists(true);
    queryMock.mockImplementationOnce(async () => ({
      rows: [{ owner_org: "x", owner_org_title: null, fiscal_year: "2023-2024", contracts: 0, sole_source_contracts: 0, total_value: "0", sole_source_value: "0" }],
    }));
    const r = await soleSourceShareByDepartment("2023-2024");
    expect(r.rows[0].sole_source_share_count).toBe(0);
    expect(r.rows[0].sole_source_share_value).toBe(0);
  });
});

describe("vendorConcentrationByDepartment", () => {
  it("computes top-vendor share from the aggregate row", async () => {
    tableExists(true);
    queryMock.mockImplementationOnce(async () => ({
      rows: [{ owner_org: "x", owner_org_title: "X", fiscal_year: "2023-2024", vendors: 10, total_value: "400", hhi: "0.31", top_vendor: "ACME", top_vendor_value: "200" }],
    }));
    const r = await vendorConcentrationByDepartment("2023", { minVendors: 3 });
    expect(queryMock.mock.calls[1][1]).toEqual(["2023-2024", 3]);
    expect(r.rows[0].top_vendor_share).toBeCloseTo(0.5);
    expect(r.rows[0].hhi).toBeCloseTo(0.31);
  });
});

describe("amendmentGrowthByVendor", () => {
  it("clamps the ratio floor to >= 1 and returns typed rows", async () => {
    tableExists(true);
    queryMock.mockImplementationOnce(async () => ({
      rows: [{ owner_org: "x", procurement_key: "P1", vendor_name: "Acme", original_value: "100", current_value: "350", growth_ratio: "3.5", amendments: 4 }],
    }));
    const r = await amendmentGrowthByVendor("Acme", { minRatio: 0.2 });
    expect(queryMock.mock.calls[1][1]).toEqual(["ACME", 1, 200]);
    expect(r.rows[0].growth_ratio).toBe(3.5);
    expect(r.rows[0].amendments).toBe(4);
  });
});
