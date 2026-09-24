import { describe, it, expect } from "vitest";
import { resolvePgConnection } from "../pool";

describe("resolvePgConnection", () => {
  it("verifies RDS hosts against the embedded CA and strips ssl params", () => {
    const r = resolvePgConnection(
      "postgresql://u:p@glassbox-db.abc.us-east-1.rds.amazonaws.com:5432/db?sslmode=require",
    );
    expect(r.ssl?.rejectUnauthorized).toBe(true);
    expect(r.ssl?.ca).toContain("BEGIN CERTIFICATE");
    expect(r.connectionString).not.toContain("sslmode");
  });
  it("keeps Render encrypted but unverified", () => {
    const r = resolvePgConnection("postgresql://u:p@dpg-x-a.oregon-postgres.render.com/db?sslmode=require");
    expect(r.ssl).toEqual({ rejectUnauthorized: false });
  });
  it("uses plaintext for localhost", () => {
    expect(resolvePgConnection("postgresql://localhost:5432/agency26").ssl).toBeUndefined();
  });
  it("passes through undefined", () => {
    expect(resolvePgConnection(undefined)).toEqual({ connectionString: undefined, ssl: undefined });
  });
});

import { isOwnedAppDatabase } from "../../evaluate/store";
describe("isOwnedAppDatabase", () => {
  it("allows RDS and localhost, refuses the Render corpus host", () => {
    expect(isOwnedAppDatabase("postgresql://u:p@glassbox-db.x.us-east-1.rds.amazonaws.com/glassbox")).toBe(true);
    expect(isOwnedAppDatabase("postgresql://localhost:5432/agency26")).toBe(true);
    expect(isOwnedAppDatabase("postgresql://u:p@dpg-x-a.oregon-postgres.render.com/db?sslmode=require")).toBe(false);
    expect(isOwnedAppDatabase(undefined)).toBe(false);
  });
});
