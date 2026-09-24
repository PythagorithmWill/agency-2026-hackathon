import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
vi.mock("../../db/pool", () => ({ query: (...a: unknown[]) => queryMock(...a) }));

import { contributionSummaryByName, contributionsByName, contributionsByPostalCode, nameVariants } from "../elections";
import { resetSchemaCache } from "../schema";

const tableExists = (exists: boolean) =>
  queryMock.mockImplementationOnce(async () => ({ rows: [{ reg: exists ? "elections.contributions" : null }] }));

beforeEach(() => {
  queryMock.mockReset();
  resetSchemaCache();
});

describe("nameVariants", () => {
  it("produces LAST, FIRST and FIRST LAST forms", () => {
    expect(nameVariants("Jane Q Smith")).toEqual(["JANE Q SMITH", "SMITH, JANE Q", "SMITH, JANE"]);
    expect(nameVariants("Smith, Jane")).toEqual(["SMITH, JANE", "JANE SMITH"]);
    expect(nameVariants("  dagenais,   violette ")).toEqual(["DAGENAIS, VIOLETTE", "VIOLETTE DAGENAIS"]);
  });
  it("leaves organisations and single tokens alone", () => {
    expect(nameVariants("Acme")).toEqual(["ACME"]);
    expect(nameVariants("The Very Long Organisation Name Of Canada")).toEqual(["THE VERY LONG ORGANISATION NAME OF CANADA"]);
    expect(nameVariants("")).toEqual([]);
  });
});

describe("contributionsByName", () => {
  it("is available:false when the schema is absent", async () => {
    tableExists(false);
    expect(await contributionsByName("Jane Smith")).toEqual({ available: false, rows: [] });
  });
  it("passes name variants and an optional normalised postal code", async () => {
    tableExists(true);
    queryMock.mockImplementationOnce(async () => ({ rows: [{ src_line: "7", monetary_amount: "100.00", non_monetary_amount: null }] }));
    const r = await contributionsByName("Jane Smith", { postalCode: "k1a 0b1", limit: 5 });
    const [sql, params] = queryMock.mock.calls[1];
    expect(sql).toMatch(/contributor_name_norm = ANY\(\$1\)/);
    expect(sql).toMatch(/contributor_postal_code = \$3/);
    expect(params).toEqual([["JANE SMITH", "SMITH, JANE"], 5, "K1A0B1"]);
    expect(r.rows[0]).toMatchObject({ src_line: 7, monetary_amount: 100, non_monetary_amount: null });
  });
  it("ignores an invalid postal code filter", async () => {
    tableExists(true);
    queryMock.mockImplementationOnce(async () => ({ rows: [] }));
    await contributionsByName("Jane Smith", { postalCode: "nope" });
    expect(queryMock.mock.calls[1][1]).toEqual([["JANE SMITH", "SMITH, JANE"], 500]);
  });
});

describe("contributionsByPostalCode / contributionSummaryByName", () => {
  it("rejects a malformed postal code before touching the DB", async () => {
    expect(await contributionsByPostalCode("12345")).toEqual({ available: false, rows: [] });
    expect(queryMock).not.toHaveBeenCalled();
  });
  it("coerces summary numerics", async () => {
    tableExists(true);
    queryMock.mockImplementationOnce(async () => ({
      rows: [{ contributor_name: "SMITH, JANE", recipient_party: "X", contributions: 3, total_amount: "450.50", first_date: "2019-01-01", last_date: null }],
    }));
    const r = await contributionSummaryByName("Jane Smith");
    expect(r.rows[0]).toEqual({ contributor_name: "SMITH, JANE", recipient_party: "X", contributions: 3, total_amount: 450.5, first_date: "2019-01-01", last_date: null });
  });
});
