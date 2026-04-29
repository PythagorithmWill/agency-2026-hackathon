"use client";

import { useMemo, useState } from "react";
import {
  WEIGHT_DIMENSIONS,
  DEFAULT_WEIGHTS,
  recalculateScore,
  scoreLabel,
  chainProofToken,
  encodeWeights,
  type WeightVector,
} from "@/lib/proofChain";
import {
  calibrationSweep,
  type Violation,
} from "@/lib/gov/validators";
import type { ProofToken } from "@/lib/types";
import { RolledNumber } from "./RolledNumber";
import { StrandConnector } from "./StrandConnector";
import { cn } from "@/lib/cn";

export function RerunClient({
  parentToken,
  subjectName,
}: {
  parentToken: ProofToken;
  subjectName: string;
}) {
  const [weights, setWeights] = useState<WeightVector>({ ...DEFAULT_WEIGHTS });
  const [chainReason, setChainReason] = useState("");
  const [pulsedTier, setPulsedTier] = useState<string | null>(null);
  const [committed, setCommitted] = useState<ProofToken | null>(null);

  const newScore = useMemo(
    () => recalculateScore(parentToken.finding.score, weights),
    [parentToken.finding.score, weights],
  );
  const newLabel = scoreLabel(newScore);
  const isHigh = newLabel === "HIGH" || newLabel === "CRITICAL";

  const validatorViolations: Violation[] = useMemo(() => {
    if (!chainReason) return [];
    return calibrationSweep(chainReason);
  }, [chainReason]);

  const validatorPassed =
    chainReason.length > 0 && validatorViolations.length === 0;

  const onWeightChange = (id: string, v: number) => {
    setWeights((w) => ({ ...w, [id]: v }));
    setPulsedTier(id);
    setTimeout(() => setPulsedTier(null), 600);
  };

  const onCommit = () => {
    if (!validatorPassed) return;
    const child = chainProofToken({
      parent: parentToken,
      weights,
      chainReason,
      validatorVerdict: {
        passed: validatorPassed,
        violationCount: validatorViolations.length,
      },
    });
    setCommitted(child);
  };

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-12">
      <header className="border-b border-[var(--color-rule)] pb-8">
        <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
          Pythagorithm Proof — Adjust Weights
        </div>
        <h1 className="mt-3 font-[var(--font-display)] text-[var(--text-display-2)] tracking-[var(--tracking-display)] leading-[1.05]">
          {subjectName}
        </h1>
        <p className="mt-4 max-w-[720px] text-[var(--text-body)] text-[var(--color-muted)] leading-[1.55]">
          Sensitivity testing made visible. Adjust the weights of any
          scoring dimension on the left; the chained Proof token recomputes
          on the right with a parent-hash pointer back to the original.
          Each chained token is independently verifiable.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_120px_1fr] gap-6 mt-12">
        {/* ORIGINAL token (left) */}
        <TokenPanel
          label="Original"
          token={parentToken}
          score={parentToken.finding.score}
          scoreLabel={
            parentToken.finding.scoreLabel as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
          }
          pulsedTier={null}
        />

        {/* Strand connector (visible only on lg+) */}
        <div className="hidden lg:flex items-start pt-12">
          <StrandConnector
            risk={isHigh ? "high" : "low"}
            className="w-full h-12"
          />
        </div>

        {/* CHAINED token (right) */}
        <TokenPanel
          label="Chained"
          token={parentToken}
          score={newScore}
          scoreLabel={newLabel}
          pulsedTier={pulsedTier}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[480px_1fr] gap-12 mt-16">
        {/* Weight sliders */}
        <section>
          <h2 className="font-[var(--font-display)] text-[var(--text-h2)] tracking-[var(--tracking-tight)]">
            Weights
          </h2>
          <p className="mt-2 text-[var(--text-small)] text-[var(--color-muted)]">
            Each dimension scales 0–10. The default vector matches the
            heuristic in <code className="font-[var(--font-mono)]">sql/canonical/findings_feed.sql</code>.
          </p>
          <div className="mt-6 space-y-6">
            {WEIGHT_DIMENSIONS.map((dim) => (
              <WeightSlider
                key={dim.id}
                id={dim.id}
                label={dim.label}
                blurb={dim.blurb}
                value={weights[dim.id]}
                onChange={(v) => onWeightChange(dim.id, v)}
              />
            ))}
          </div>
        </section>

        {/* Chain reason + validator */}
        <section>
          <h2 className="font-[var(--font-display)] text-[var(--text-h2)] tracking-[var(--tracking-tight)]">
            Chain reason
          </h2>
          <p className="mt-2 text-[var(--text-small)] text-[var(--color-muted)]">
            A brief, calibrated rationale for this re-score. PYTH-GOV
            validates the rationale before the chain is committed.
          </p>
          <textarea
            value={chainReason}
            onChange={(e) => setChainReason(e.target.value)}
            placeholder="e.g. Adjusted weights to test sensitivity to T3010 violation evidence."
            rows={4}
            className={cn(
              "mt-4 w-full border bg-transparent px-4 py-3 font-[var(--font-sans)] text-[var(--text-body-ui)] rounded-[6px]",
              "placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-paper)]",
              validatorViolations.length > 0
                ? "border-[var(--color-ember)]"
                : "border-[var(--color-rule)]",
            )}
          />

          {/* Validator visibility */}
          <ValidatorPanel
            violations={validatorViolations}
            empty={chainReason.length === 0}
            passed={validatorPassed}
            onApplySuggestion={(rewrite, original) => {
              setChainReason((r) =>
                r.replace(new RegExp(`\\b${escapeRegExp(original)}\\b`, "i"), rewrite),
              );
            }}
          />

          {!committed && (
            <button
              type="button"
              onClick={onCommit}
              disabled={!validatorPassed}
              className={cn(
                "mt-8 inline-flex items-center gap-3 px-6 py-3 rounded-[6px] font-[var(--font-sans)] text-[var(--text-body-ui)] transition-colors",
                validatorPassed
                  ? "bg-[var(--color-paper)] text-[var(--color-ink)] hover:opacity-90"
                  : "border border-[var(--color-rule)] text-[var(--color-muted)] cursor-not-allowed",
              )}
            >
              Commit chain
              <span aria-hidden className="font-[var(--font-mono)] text-[var(--text-small)] opacity-70">
                ↗
              </span>
            </button>
          )}

          {committed && (
            <div className="mt-8 border border-[var(--color-sage)] rounded-[6px] p-6">
              <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-sage)]">
                Chain committed
              </div>
              <div className="mt-2 font-[var(--font-mono)] text-[var(--text-mono)] break-all">
                {committed.proofId}
              </div>
              <div className="mt-1 font-[var(--font-mono)] text-[var(--text-micro)] text-[var(--color-muted)]">
                parent: {committed.tiers.audit.previousTokenHash?.slice(0, 28)}…
              </div>
              <a
                href={
                  `/proof/${committed.proofId}?parent=${parentToken.proofId}` +
                  `&w=${encodeWeights(weights)}` +
                  `&reason=${encodeURIComponent(chainReason)}`
                }
                className="mt-4 inline-block text-[var(--text-small)] text-[var(--color-paper)] underline-offset-2 hover:underline"
              >
                Open permalink →
              </a>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function TokenPanel({
  label,
  token,
  score,
  scoreLabel,
  pulsedTier,
}: {
  label: string;
  token: ProofToken;
  score: number;
  scoreLabel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  pulsedTier: string | null;
}) {
  const isHigh = scoreLabel === "HIGH" || scoreLabel === "CRITICAL";
  return (
    <div className="border border-[var(--color-rule)] bg-[var(--color-vellum)] rounded-[8px] p-6">
      <div className="flex items-baseline justify-between">
        <div className="font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
          {label}
        </div>
        <div
          className={cn(
            "font-[var(--font-mono)] text-[var(--text-micro)] uppercase tracking-[var(--tracking-wide)]",
            isHigh ? "text-[var(--color-ember)]" : "text-[var(--color-sage)]",
          )}
        >
          {scoreLabel}
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-4">
        <RolledNumber
          value={score}
          className={cn(
            "font-[var(--font-mono)] leading-none",
            "text-[3.5rem]",
            isHigh ? "text-[var(--color-ember)]" : "text-[var(--color-paper)]",
          )}
        />
        <span className="font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-muted)]">
          / 30
        </span>
      </div>

      <ul className="mt-6 space-y-2 font-[var(--font-mono)] text-[var(--text-mono)]">
        {([
          ["federal_concentration", "Input", token.tiers.input.passed],
          ["cra_loops", "Context", token.tiers.contextual.passed],
          ["t3010_violations", "Output", token.tiers.output.passed],
          ["dataset_cross_coverage", "Audit", token.tiers.audit.passed],
        ] as const).map(([id, lbl, passed]) => (
          <li
            key={id}
            data-pulsed={pulsedTier === id ? "true" : undefined}
            className={cn(
              "flex items-baseline justify-between rounded-[4px] px-2 py-1 -mx-2",
              "transition-colors",
              pulsedTier === id && "animate-tier-pulse",
            )}
          >
            <span className="text-[var(--color-paper)]">{lbl}</span>
            <span
              className={
                passed
                  ? "text-[var(--color-sage)]"
                  : "text-[var(--color-ember)]"
              }
            >
              {passed ? "passed" : "failed"}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 font-[var(--font-mono)] text-[var(--text-micro)] text-[var(--color-muted)] break-all">
        {token.proofId}
      </div>
    </div>
  );
}

function WeightSlider({
  id,
  label,
  blurb,
  value,
  onChange,
}: {
  id: string;
  label: string;
  blurb: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={`weight-${id}`}
          className="font-[var(--font-sans)] text-[var(--text-body-ui)]"
        >
          {label}
        </label>
        <span className="font-[var(--font-mono)] text-[var(--text-mono)] text-[var(--color-paper)] tabular-nums">
          {value.toFixed(0)}
        </span>
      </div>
      <input
        id={`weight-${id}`}
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--color-paper)]"
      />
      <div className="mt-1 font-[var(--font-mono)] text-[var(--text-micro)] text-[var(--color-muted)]">
        {blurb}
      </div>
    </div>
  );
}

function ValidatorPanel({
  violations,
  empty,
  passed,
  onApplySuggestion,
}: {
  violations: Violation[];
  empty: boolean;
  passed: boolean;
  onApplySuggestion: (rewrite: string, originalMatch: string) => void;
}) {
  return (
    <div className="mt-3 min-h-[3rem] font-[var(--font-mono)] text-[var(--text-micro)]">
      {empty && (
        <span className="uppercase tracking-[var(--tracking-wide)] text-[var(--color-muted)]">
          PYTH-GOV idle — type a chain reason to validate
        </span>
      )}
      {!empty && passed && (
        <span className="uppercase tracking-[var(--tracking-wide)] text-[var(--color-sage)]">
          PYTH-GOV: calibration passed · 0 violations
        </span>
      )}
      {!empty && !passed && (
        <ul className="space-y-2">
          {violations.map((v, i) => (
            <li key={i} className="border border-[var(--color-ember)] rounded-[4px] px-3 py-2">
              <div className="uppercase tracking-[var(--tracking-wide)] text-[var(--color-ember)]">
                {v.type}
              </div>
              <div className="mt-1 text-[var(--color-paper)]">
                Match: <span className="text-[var(--color-ember)]">{v.match}</span>
              </div>
              {v.rewrite && (
                <button
                  type="button"
                  onClick={() => onApplySuggestion(v.rewrite!, v.match ?? "")}
                  className="mt-1 text-[var(--color-muted)] hover:text-[var(--color-paper)] underline-offset-2 hover:underline text-left"
                >
                  Suggest: {v.rewrite}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
