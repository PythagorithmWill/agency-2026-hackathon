import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
vi.mock("../../db/pool", () => ({ query: (...a: unknown[]) => queryMock(...a) }));

import { corporationsByNameOrBn, corporationsByPostalCode, directorsByPerson, directorsOfCorporation } from "../corp";
import { resetSchemaCache } from "../schema";

const tableExists = (name: string | null) => queryMock.mockImplementationOnce(async () => ({ rows: [{ reg: name }] }));

beforeEach(() => {
  queryMock.mockReset();
  resetSchemaCache();
});

describe("corporationsByNameOrBn", () => {
  it("detects a business number (9 or 15 chars) and queries by BN", async () => {
    tableExists("corp.corporations");
    queryMock.mockImplementationOnce(async () => ({ rows: [{ corporation_number: "1", min_directors: "1", max_directors: "10", year_of_last_annual_filing: null }] }));
    const r = await corporationsByNameOrBn("835752437RC0001");
    expect(queryMock.mock.calls[1][0]).toMatch(/business_number = \$1/);
    expect(queryMock.mock.calls[1][1]).toEqual(["835752437", 100]);
    expect(r.rows[0]).toMatchObject({ min_directors: 1, max_directors: 10, year_of_last_annual_filing: null });
  });
  it("otherwise matches either name form on the normalised name", async () => {
    tableExists("corp.corporations");
    queryMock.mockImplementationOnce(async () => ({ rows: [] }));
    await corporationsByNameOrBn("  Gestion  FNX Inc. ");
    expect(queryMock.mock.calls[1][0]).toMatch(/name_norm = \$1 OR upper\(trim\(name_form2\)\) = \$1/);
    expect(queryMock.mock.calls[1][1]).toEqual(["GESTION FNX INC.", 100]);
  });
  it("is available:false when the schema is absent", async () => {
    tableExists(null);
    expect(await corporationsByNameOrBn("Acme")).toEqual({ available: false, rows: [] });
  });
});

describe("corporationsByPostalCode", () => {
  it("normalises the postal code and honours activeOnly", async () => {
    tableExists("corp.corporations");
    queryMock.mockImplementationOnce(async () => ({ rows: [] }));
    await corporationsByPostalCode("k2k 3g4", { activeOnly: true });
    expect(queryMock.mock.calls[1][0]).toMatch(/postal_code = \$1 AND status = 'Active'/);
    expect(queryMock.mock.calls[1][1]).toEqual(["K2K3G4", 200]);
  });
});

describe("directors helpers", () => {
  it("directorsByPerson is available:false until corp.directors exists", async () => {
    tableExists(null);
    expect(await directorsByPerson("Jane Smith")).toEqual({ available: false, rows: [] });
    expect(queryMock.mock.calls[0][1]).toEqual(["corp.directors"]);
  });
  it("directorsOfCorporation validates the corporation number", async () => {
    expect(await directorsOfCorporation("abc")).toEqual({ available: false, rows: [] });
    expect(queryMock).not.toHaveBeenCalled();
    tableExists("corp.directors");
    queryMock.mockImplementationOnce(async () => ({ rows: [{ corporation_number: "8660115", director_name: "X" }] }));
    const r = await directorsOfCorporation(" 8660115 ");
    expect(r.available).toBe(true);
    expect(queryMock.mock.calls[1][1]).toEqual(["8660115"]);
  });
});
