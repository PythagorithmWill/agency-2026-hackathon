import { NextResponse } from "next/server";
import { findProofTokenById } from "@/lib/proofRegistry";

// Public origin used for the self-describing verifyAt URL embedded in the
// exported token. Must match metadataBase in src/app/layout.tsx — the bare
// pythagorithm.ai host has no /verify route and 404s.
const SITE_ORIGIN = "https://glassbox.pythagorithm.ai";

export async function GET(
  _request: Request,
  context: { params: Promise<{ proofId: string }> },
): Promise<Response> {
  // Route-handler params arrive already percent-decoded (unlike page
  // params, which arrive raw). A second decodeURIComponent throws
  // URIError on any literal "%" (e.g. /api/proof/%25zz/download → 500).
  const { proofId } = await context.params;
  const found = findProofTokenById(proofId);
  if (!found) {
    return NextResponse.json(
      { error: "proof token not found", proofId },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  const verifiability = {
    issuer: "Glassbox · built on the Pythagorithm Proof Methodology",
    issuedAt: found.token.issuedAt,
    methodologyVersion: found.token.version,
    verifyAt: `${SITE_ORIGIN}/verify/${found.token.proofId}`,
    note: "This audit token was issued by Glassbox under the Pythagorithm Proof Methodology v1.0. The verifyAt URL renders an independent gate-by-gate validation page. The tokenHash in tiers.audit is a SHA-256 over the canonical token with the hash field blanked; recompute it to detect tampering.",
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
