"use client";

import { useMemo, useState } from "react";
import { FindingCard } from "./FindingCard";
import { ProofDrawer } from "./ProofDrawer";
import { Strand } from "./Strand";
import { StrataPanel } from "./StrataPanel";
import { AIARegisterPanel } from "./AIARegisterPanel";
import type { FindingCard as FindingCardType, AIAEntry } from "@/lib/types";
import aiaRegister from "@/data/aia-register.json";

interface State {
  selectedProofId: string | null;
  drawerOpen: boolean;
  strandFrom: { x: number; y: number } | null;
  strandTo: { x: number; y: number } | null;
  strandVisible: boolean;
  query: string;
  sortBy: "risk" | "name" | "indicators";
}

const initialState: State = {
  selectedProofId: null,
  drawerOpen: false,
  strandFrom: null,
  strandTo: null,
  strandVisible: false,
  query: "",
  sortBy: "risk",
};

export function GlassBox({ findings }: { findings: FindingCardType[] }) {
  const [state, setState] = useState<State>(initialState);

  const visible = useMemo(() => {
    const q = state.query.trim().toLowerCase();
    const filtered = q
      ? findings.filter((f) =>
          [
            f.proofToken.finding.subject.canonicalName,
            f.proofToken.finding.summary,
            f.proofToken.finding.subject.bnRoot ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : findings;

    const sorted = [...filtered].sort((a, b) => {
      if (state.sortBy === "name") {
        return a.proofToken.finding.subject.canonicalName.localeCompare(
          b.proofToken.finding.subject.canonicalName,
        );
      }
      if (state.sortBy === "indicators") {
        return b.indicatorCount - a.indicatorCount;
      }
      return b.proofToken.finding.score - a.proofToken.finding.score;
    });

    return sorted;
  }, [findings, state.query, state.sortBy]);

  const selectedFinding = visible.find(
    (f) => f.proofToken.proofId === state.selectedProofId,
  );

  const onBadgeClick = (proofId: string, rect: DOMRect) => {
    setState((s) => ({
      ...s,
      selectedProofId: proofId,
      drawerOpen: false,
      strandFrom: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      strandTo: { x: window.innerWidth - 240, y: rect.top + rect.height / 2 },
      strandVisible: true,
    }));
  };

  const onStrandComplete = () => {
    setState((s) => ({ ...s, drawerOpen: true }));
  };

  const onCloseDrawer = () => {
    setState((s) => ({
      ...s,
      drawerOpen: false,
      strandVisible: false,
      selectedProofId: null,
    }));
  };

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* Left column — findings feed */}
      <section>
        <header className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-6">
          <div>
            <h1 className="font-[var(--font-display)] text-[var(--text-h1)] tracking-[var(--tracking-tight)]">
              The Glass Box
            </h1>
            <p className="mt-2 text-[var(--text-small)] text-[var(--color-muted)]">
              Accountability findings from the federal grants &amp;
              contributions corpus, the CRA T3010 charity registry, and the
              Government of Alberta open data set. Every finding carries a
              Pythagorithm Proof badge with full reasoning trace.
            </p>
          </div>
          <div className="font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-muted)]">
            {visible.length} of {findings.length}
          </div>
        </header>

        <div className="mt-6 flex flex-wrap items-baseline gap-4">
          <SearchInput
            value={state.query}
            onChange={(v) => setState((s) => ({ ...s, query: v }))}
          />
          <SortControl
            value={state.sortBy}
            onChange={(v) => setState((s) => ({ ...s, sortBy: v }))}
          />
        </div>

        <div className="mt-6">
          {visible.map((f) => (
            <FindingCard
              key={f.proofToken.proofId}
              finding={f}
              onSelect={onBadgeClick}
              selected={f.proofToken.proofId === state.selectedProofId}
            />
          ))}
          {visible.length === 0 && (
            <p className="mt-12 text-[var(--color-muted)]">
              No records match this query. The data scope is documented in
              <a href="/about/scope" className="ml-1 underline">about/scope</a>.
            </p>
          )}
        </div>
      </section>

      {/* Right column — Strata, AIA Register, Proof Drawer slot */}
      <aside className="space-y-6">
        <StrataPanel
          activeId={selectedFinding ? activeStratumFor(selectedFinding) : null}
          riskLevel={
            selectedFinding &&
            (selectedFinding.proofToken.finding.scoreLabel === "HIGH" ||
              selectedFinding.proofToken.finding.scoreLabel === "CRITICAL")
              ? "high"
              : "low"
          }
        />
        <AIARegisterPanel entries={aiaRegister as unknown as AIAEntry[]} />
      </aside>

      {/* Strand + Drawer overlays */}
      {state.strandFrom && state.strandTo && (
        <Strand
          from={state.strandFrom}
          to={state.strandTo}
          risk={
            selectedFinding &&
            (selectedFinding.proofToken.finding.scoreLabel === "HIGH" ||
              selectedFinding.proofToken.finding.scoreLabel === "CRITICAL")
              ? "high"
              : "low"
          }
          visible={state.strandVisible && !state.drawerOpen}
          onComplete={onStrandComplete}
        />
      )}
      <ProofDrawer
        token={selectedFinding?.proofToken ?? null}
        open={state.drawerOpen}
        onClose={onCloseDrawer}
      />
    </div>
  );
}

function activeStratumFor(_f: FindingCardType): string {
  // Source-linked findings (CRA loops, FED amendment creep) sit at S4.
  // Outcome briefs that have synthesis sit at S3. Glass Box findings are
  // primarily S4 — we descended along a strand to a source row.
  return "S4";
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="search"
      placeholder="Search by entity, BN, or program"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full max-w-[360px] border border-[var(--color-rule)] bg-transparent px-4 py-3 font-[var(--font-sans)] text-[var(--text-body-ui)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-paper)] focus:outline-none rounded-[6px]"
    />
  );
}

function SortControl({
  value,
  onChange,
}: {
  value: "risk" | "name" | "indicators";
  onChange: (v: "risk" | "name" | "indicators") => void;
}) {
  const opts: { id: "risk" | "name" | "indicators"; label: string }[] = [
    { id: "risk", label: "Score" },
    { id: "indicators", label: "Indicators" },
    { id: "name", label: "Name" },
  ];
  return (
    <div className="flex items-baseline gap-3 font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
      <span>Sort:</span>
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={
            value === o.id
              ? "text-[var(--color-paper)]"
              : "hover:text-[var(--color-paper)]"
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
