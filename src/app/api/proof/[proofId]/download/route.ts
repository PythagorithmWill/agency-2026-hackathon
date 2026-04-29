import { NextResponse } from "next/server";
import { findProofTokenById } from "@/lib/proofRegistry";

export async function GET(
  _request: Request,
  context: { params: Promise<{ proofId: string }> },
): Promise<Response> {
  const { proofId } = await context.params;
  const decoded = decodeURIComponent(proofId);
  const found = findProofTokenById(decoded);
  if (!found) {
    return NextResponse.json(
      { error: "proof token not found", proofId: decoded },
      { status: 404 },
    );
  }
  const verifiability = {
    issuer: "Glassbox · built on the Pythagorithm Proof Methodology",
    issuedAt: found.token.issuedAt,
    methodologyVersion: found.token.version,
    verifyAt: `https://pythagorithm.ai/verify/${found.token.proofId}`,
    note: "This audit token was issued by Glassbox under the Pythagorithm Proof Methodology v1.0. The verifyAt URL renders an independent gate-by-gate validation pass.",
  };
  const payload = { ...found.token, _verifiability: verifiability };
  const body = JSON.stringify(payload, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ppm-${found.token.proofId}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
