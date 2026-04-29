import { MapleLeafLoader } from "@/components/brand/MapleLeafLoader";

export default function Loading() {
  return (
    <main className="min-h-screen pt-32 flex items-center justify-center">
      <MapleLeafLoader size={120} caption="Running pattern detector against the corpus" />
    </main>
  );
}
