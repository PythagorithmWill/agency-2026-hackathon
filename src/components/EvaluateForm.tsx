"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { calibrationFlags } from "@/lib/gov/validators";

const DEPARTMENTS = [
  "Innovation, Science and Economic Development Canada",
  "Employment and Social Development Canada",
  "Natural Resources Canada",
  "Crown-Indigenous Relations and Northern Affairs Canada",
  "Indigenous Services Canada",
  "Canada Mortgage and Housing Corporation",
  "Public Services and Procurement Canada",
  "Transport Canada",
  "Global Affairs Canada",
  "Health Canada",
];

export function EvaluateForm({ initialDraft = "" }: { initialDraft?: string }) {
  const router = useRouter();
  const [working, start] = useTransition();
  const [draftText, setDraftText] = useState(initialDraft);
  const [workingTitle, setWorkingTitle] = useState("");
  const [anticipatedAmount, setAnticipatedAmount] = useState<string>("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [fiscalYear, setFiscalYear] = useState(2027);

  const flags = useMemo(() => calibrationFlags(draftText), [draftText]);

  const onSubmit = async () => {
    if (!draftText.trim() || !workingTitle.trim()) return;
    const submission = {
      workingTitle,
      draftText,
      awardingDepartment: department,
      anticipatedAmount: Number(anticipatedAmount.replace(/[^0-9.]/g, "")) || 0,
      anticipatedFiscalYear: fiscalYear,
    };
    const res = await fetch("/api/draft/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });
    if (!res.ok) {
      console.error("evaluate failed", res.status);
      return;
    }
    const data = (await res.json()) as { evaluationId: string };
    start(() => {
      router.push((`/evaluate/${data.evaluationId}`) as never);
    });
  };

  return (
    <div className="mx-auto max-w-[960px] px-6 py-16">
      <header>
        <div className="font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
          Glassbox · Evaluate
        </div>
        <h1 className="mt-6 text-[var(--text-display-md)] tracking-[var(--tracking-display-md)] font-semibold leading-[52px]">
          Evaluate a draft
        </h1>
        <p className="mt-4 text-[var(--text-body-lg)] text-[var(--color-fg-muted)] leading-[28px] max-w-[720px]">
          Paste your draft solicitation. The system will surface comparable
          existing records, recipient concentration, calibrated-language
          flags, and a composite suitability score before you publish.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="mt-12 space-y-8"
      >
        {/* Working title */}
        <Field
          label="Working title"
          hint="A short, descriptive line. Will appear at the top of the evaluation."
        >
          <input
            type="text"
            value={workingTitle}
            onChange={(e) => setWorkingTitle(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-[8px] border border-[var(--color-border-strong)] bg-transparent text-[var(--text-body)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-fg)] transition-colors"
            placeholder="e.g. Northern community broadband expansion, FY2027"
          />
        </Field>

        {/* Anticipated amount + dept + fiscal year */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field label="Anticipated amount" hint="Approximate. Will not be public.">
            <input
              type="text"
              inputMode="numeric"
              value={anticipatedAmount}
              onChange={(e) => setAnticipatedAmount(e.target.value)}
              className="w-full px-4 py-3 rounded-[8px] border border-[var(--color-border-strong)] bg-transparent text-[var(--text-body)] focus:outline-none focus:border-[var(--color-fg)] transition-colors"
              placeholder="$4,200,000"
            />
          </Field>
          <Field label="Awarding department">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-3 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-bg)] text-[var(--text-body)] focus:outline-none focus:border-[var(--color-fg)] transition-colors"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fiscal year">
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-bg)] text-[var(--text-body)] focus:outline-none focus:border-[var(--color-fg)] transition-colors"
            >
              {[2026, 2027, 2028, 2029].map((y) => (
                <option key={y} value={y}>
                  FY{y}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Draft text */}
        <Field
          label="Draft text"
          hint="Paste the body of the draft solicitation. As you type, the calibrated-language sweep runs in real time."
        >
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={12}
            required
            placeholder="Funding to expand fixed-wireless broadband across northern communities. The recipient will deliver…"
            className="w-full px-4 py-3 rounded-[8px] border border-[var(--color-border-strong)] bg-transparent text-[var(--text-body)] leading-[24px] resize-y placeholder:italic placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-fg)] transition-colors min-h-[260px] font-[var(--font-sans)]"
          />
          <div className="mt-3 flex items-center justify-between font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.08em]">
            <span className="text-[var(--color-fg-subtle)]">{draftText.length} chars</span>
            <span
              className={
                flags.length === 0
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-accent-warn)]"
              }
            >
              {flags.length === 0
                ? "PYTH-GOV: 0 calibration flags"
                : `PYTH-GOV: ${flags.length} flag${flags.length === 1 ? "" : "s"}`}
            </span>
          </div>
        </Field>

        <div className="flex items-center justify-end gap-4">
          <button
            type="submit"
            disabled={working || !draftText.trim() || !workingTitle.trim()}
            className="group inline-flex items-center gap-3 px-7 h-14 rounded-[16px] bg-[var(--color-accent)] text-[var(--color-bg)] text-[var(--text-body)] font-semibold hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Evaluate draft
            <span aria-hidden className="transition-transform group-hover:translate-x-2">
              →
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block font-[var(--font-mono)] text-[var(--text-caption)] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
        {label}
      </label>
      <div className="mt-3">{children}</div>
      {hint && (
        <div className="mt-2 text-[var(--text-body-sm)] text-[var(--color-fg-subtle)] leading-[20px]">
          {hint}
        </div>
      )}
    </div>
  );
}
