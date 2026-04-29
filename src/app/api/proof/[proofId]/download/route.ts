import { NextResponse } from "next/server";
import { findProofTokenById } from "@/lib/proofRegistry";

export async function GET(
  _request: Request,
  context: { params: Promise<{ proofId: string }> },
): Promise<Response> {
  const { proofId } = await context.params;
  const decoded = decodeURIComponent(proofId);
  const found = await findProofTokenById(decoded);
  if (!found) {
    return NextResponse.json(
      { error: "proof token not found", proofId: decoded },
      { status: 404 },
    );
  }
  const verifiability = {
    issuer: "Pythagorithm Proof Methodology",
    issuedAt: found.token.issuedAt,
    methodologyVersion: found.token.version,
    verifyAt: `https://pythagorithm.ai/verify/${found.token.proofId}`,
    note: "This token was issued by the Pythagorithm Proof Methodology. The verifyAt URL renders an independent gate-by-gate validation pass.",
  };
  const payload = {
    ...found.token,
    _verifiability: verifiability,
  };
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
