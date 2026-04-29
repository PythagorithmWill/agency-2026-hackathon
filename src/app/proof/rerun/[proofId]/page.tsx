import { notFound } from "next/navigation";
import { ProofHeader } from "@/components/ProofHeader";
import { RerunClient } from "@/components/proof/RerunClient";
import { findProofTokenById } from "@/lib/proofRegistry";

export default async function ProofRerunPage({
  params,
}: {
  params: Promise<{ proofId: string }>;
}) {
  const { proofId } = await params;
  const decoded = decodeURIComponent(proofId);
  const found = await findProofTokenById(decoded);
  if (!found) notFound();
  return (
    <>
      <ProofHeader />
      <main>
        <RerunClient parentToken={found.token} subjectName={found.subjectName} />
      </main>
    </>
  );
}
