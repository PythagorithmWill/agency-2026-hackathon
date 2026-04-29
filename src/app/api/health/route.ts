import { NextResponse } from "next/server";
import { dataSourceHealthCheck } from "@/lib/db/healthcheck";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const report = await dataSourceHealthCheck();
  const overall =
    [report.fed, report.ab_grants, report.ab_contracts, report.general, report.cra]
      .map((s) => s.status)
      .includes("down")
      ? "down"
      : [report.fed, report.ab_grants, report.ab_contracts, report.general, report.cra]
            .map((s) => s.status)
            .includes("degraded")
        ? "degraded"
        : "ok";

  return NextResponse.json(
    {
      overall,
      ...report,
    },
    {
      status: overall === "down" ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
