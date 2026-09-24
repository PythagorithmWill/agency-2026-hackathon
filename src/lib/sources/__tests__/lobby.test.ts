import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
vi.mock("../../db/pool", () => ({ query: (...a: unknown[]) => queryMock(...a) }));

import { LOBBY_VIEW, lobbyingByClient, lobbyingByRegistrant, toIdent, uniqueIdents } from "../lobby";
import { resetSchemaCache } from "../schema";

beforeEach(() => {
  queryMock.mockReset();
  resetSchemaCache();
});

describe("lobby helpers", () => {
  it("are available:false while the typed view is absent", async () => {
    queryMock.mockImplementationOnce(async () => ({ rows: [{ reg: null }] }));
    expect(await lobbyingByClient("Acme")).toEqual({ available: false, rows: [] });
    expect(queryMock.mock.calls[0][1]).toEqual([LOBBY_VIEW]);
  });
  it("query the view by normalised client / registrant name", async () => {
    queryMock.mockImplementationOnce(async () => ({ rows: [{ reg: LOBBY_VIEW }] }));
    queryMock.mockImplementationOnce(async () => ({ rows: [{ registration_number: "1" }] }));
    const r = await lobbyingByClient("  acme  inc ", { limit: 10 });
    expect(r.available).toBe(true);
    expect(queryMock.mock.calls[1][0]).toMatch(/upper\(trim\(client_name\)\) = \$1/);
    expect(queryMock.mock.calls[1][1]).toEqual(["ACME INC", 10]);
    queryMock.mockImplementationOnce(async () => ({ rows: [] }));
    await lobbyingByRegistrant("Jane Lobbyist");
    expect(queryMock.mock.calls[2][0]).toMatch(/upper\(trim\(registrant_name\)\) = \$1/);
  });
});

describe("header-driven loader identifiers", () => {
  it("turns bilingual headers into safe snake_case columns", () => {
    expect(toIdent("Client Name / Nom du client", 3)).toBe("client_name_nom_du_client");
    expect(toIdent("Année", 1)).toBe("annee");
    expect(toIdent("123", 4)).toBe("col_4");
    expect(toIdent("", 0)).toBe("col_0");
  });
  it("deduplicates repeated headers", () => {
    expect(uniqueIdents(["a", "b", "a", "a"])).toEqual(["a", "b", "a_2", "a_3"]);
  });
});
