"use client";

import { useEffect, useState, useRef, useCallback } from "react";

/**
 * Lightweight guided tour. Renders a full-page dimmer with a cutout
 * around the active step's target element and a tooltip card with
 * Next / Previous / Skip controls.
 *
 * No external library. The "completed" flag persists in localStorage
 * so a returning visitor doesn't see the tour again — they can re-run
 * it from the launcher button in the bottom-right corner.
 *
 * Target lookup uses [data-tour-id="..."] attributes on the elements
 * we want to highlight. If a step's target isn't on the current page,
 * the tour navigates to the step's `path` first, then re-anchors.
 */

const STORAGE_KEY = "glassbox.tour.completed.v1";

interface Step {
  /** [data-tour-id] of the element to highlight, or null for a centered card. */
  targetId: string | null;
  /** Optional path the tour should navigate to for this step. */
  path?: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    targetId: null,
    path: "/",
    title: "Welcome to Glassbox",
    body:
      "A transparency platform for Canadian government spending. 1.27M federal grants & contributions, 2.05M Alberta provincial records, 851K cross-dataset entities. Every figure cites a source row. The tour takes ~90 seconds.",
  },
  {
    targetId: "tour-search",
    path: "/",
    title: "Search the corpus",
    body:
      "Type a topic, recipient, or program. Hybrid keyword retrieval ranks across federal + Alberta sources. Pre-expanded acronyms (AI → artificial intelligence, EV → electric vehicle).",
  },
  {
    targetId: "tour-nav-follow",
    title: "Follow the money",
    body:
      "Nine named pattern detectors — zombie recipients, ghost capacity, vendor concentration, funding loops, and more. Each pattern surfaces specific records with calibrated severity.",
  },
  {
    targetId: "tour-nav-recommendations",
    title: "Recommendations",
    body:
      "The decision-intelligence layer. Each recommendation pairs the underlying pattern with monetary impact, risk overview, audit-trail evidence, and a calibrated execution timeline.",
  },
  {
    targetId: "tour-nav-transparency",
    title: "Transparency dashboard",
    body:
      "Aggregate views across the corpus — by department, recipient, program, fiscal year. Concentration metrics (HHI, Lorenz curves), recent large agreements, amendment growth.",
  },
  {
    targetId: "tour-nav-methodology",
    title: "Methodology & calibration",
    body:
      "Glassbox surfaces correlations and observations, not findings. Every detector lists its threshold. Every match cites its source rows. No causal claims — funder decides the response.",
  },
  {
    targetId: null,
    title: "Ready to explore",
    body:
      "Pick any pattern card on /follow, click a recommendation on /recommendations to see its full detail, or search the corpus from the header. Re-run this tour any time from the bottom-right launcher.",
  },
];

export function GuidedTour() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Show the tour automatically on first visit. The localStorage flag is
  // set whenever the user finishes or skips. Returning visitors only see
  // the floating launcher button.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setActive(true);
    } catch {
      // localStorage may be unavailable (private mode); fall back to no auto-start.
    }
  }, []);

  // Re-measure the target element whenever the step changes or the
  // window scrolls / resizes.
  const recalc = useCallback(() => {
    const step = STEPS[stepIndex];
    if (!step?.targetId) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(
      `[data-tour-id="${step.targetId}"]`,
    );
    if (!el) {
      setTargetRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Wait one frame for the scroll to land before measuring.
    requestAnimationFrame(() => {
      setTargetRect(el.getBoundingClientRect());
    });
  }, [stepIndex]);

  useEffect(() => {
    if (!active) return;
    recalc();
    const onResize = () => recalc();
    const onScroll = () => recalc();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [active, recalc]);

  // Navigate when a step has a path and we're not already there.
  useEffect(() => {
    if (!active) return;
    const step = STEPS[stepIndex];
    if (step?.path && window.location.pathname !== step.path) {
      // Soft client-side nav by setting the URL — the layout components
      // re-render via Next's app router. We don't import next/navigation
      // here because GuidedTour can be mounted before the router is
      // ready; a vanilla pushState + popstate dispatch is sufficient
      // for the tour's needs.
      window.history.pushState({}, "", step.path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [active, stepIndex]);

  function dismiss() {
    setActive(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore — see useEffect note above
    }
  }

  function relaunch() {
    setStepIndex(0);
    setActive(true);
  }

  function next() {
    if (stepIndex >= STEPS.length - 1) dismiss();
    else setStepIndex((i) => i + 1);
  }

  function prev() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  if (!active) {
    // Floating relaunch pill in the bottom-right.
    return (
      <button
        type="button"
        onClick={relaunch}
        className="fixed bottom-5 right-5 z-[2000] rounded-full bg-[var(--color-bg-elev-1)] border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] px-4 py-2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] shadow-lg transition-colors"
        aria-label="Take the Glassbox tour"
      >
        ✦ Tour
      </button>
    );
  }

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[1900] pointer-events-none">
      {/* Dimmer with cutout */}
      <Dimmer rect={targetRect} />

      {/* Tooltip / centered card */}
      {targetRect ? (
        <Tooltip
          rect={targetRect}
          step={step}
          stepIndex={stepIndex}
          total={STEPS.length}
          isLast={isLast}
          onNext={next}
          onPrev={prev}
          onSkip={dismiss}
        />
      ) : (
        <CenteredCard
          step={step}
          stepIndex={stepIndex}
          total={STEPS.length}
          isLast={isLast}
          onNext={next}
          onPrev={prev}
          onSkip={dismiss}
        />
      )}
    </div>
  );
}

function Dimmer({ rect }: { rect: DOMRect | null }) {
  // No target: full-screen dim. Target: SVG mask with rounded cutout.
  if (!rect) {
    return (
      <div
        className="absolute inset-0 bg-black/70 pointer-events-auto"
        aria-hidden
      />
    );
  }
  const pad = 8;
  const x = Math.max(0, rect.left - pad);
  const y = Math.max(0, rect.top - pad);
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ width: "100vw", height: "100vh" }}
      aria-hidden
    >
      <defs>
        <mask id="tour-cutout">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={8} ry={8} fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.7)"
        mask="url(#tour-cutout)"
      />
      {/* Highlight outline on the cutout */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        ry={8}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={2}
        strokeOpacity={0.9}
      />
    </svg>
  );
}

function Tooltip({
  rect,
  step,
  stepIndex,
  total,
  isLast,
  onNext,
  onPrev,
  onSkip,
}: {
  rect: DOMRect;
  step: Step;
  stepIndex: number;
  total: number;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  // Choose tooltip side: below the target if there's room, above otherwise.
  const tooltipWidth = 360;
  const tooltipMaxHeight = 220;
  const margin = 16;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;

  let top = rect.bottom + margin;
  let left = rect.left + rect.width / 2 - tooltipWidth / 2;
  if (top + tooltipMaxHeight > vh - margin) {
    top = rect.top - margin - tooltipMaxHeight;
  }
  // Clamp horizontally
  left = Math.max(margin, Math.min(left, vw - tooltipWidth - margin));
  // Clamp vertically too in case nothing fits
  top = Math.max(margin, Math.min(top, vh - tooltipMaxHeight - margin));

  return (
    <div
      className="absolute pointer-events-auto rounded-[12px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-5 shadow-2xl"
      style={{ top, left, width: tooltipWidth }}
      role="dialog"
      aria-label={step.title}
    >
      <Header stepIndex={stepIndex} total={total} title={step.title} />
      <p className="mt-3 text-[13.5px] leading-[1.55] text-[var(--color-fg-muted)]">
        {step.body}
      </p>
      <Controls
        isLast={isLast}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
        canGoBack={stepIndex > 0}
      />
    </div>
  );
}

function CenteredCard({
  step,
  stepIndex,
  total,
  isLast,
  onNext,
  onPrev,
  onSkip,
}: {
  step: Step;
  stepIndex: number;
  total: number;
  isLast: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="pointer-events-auto rounded-[14px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-6 shadow-2xl max-w-[440px] mx-6"
        role="dialog"
        aria-label={step.title}
      >
        <Header stepIndex={stepIndex} total={total} title={step.title} />
        <p className="mt-3 text-[14px] leading-[1.55] text-[var(--color-fg-muted)]">
          {step.body}
        </p>
        <Controls
          isLast={isLast}
          onNext={onNext}
          onPrev={onPrev}
          onSkip={onSkip}
          canGoBack={stepIndex > 0}
        />
      </div>
    </div>
  );
}

function Header({
  stepIndex,
  total,
  title,
}: {
  stepIndex: number;
  total: number;
  title: string;
}) {
  return (
    <div>
      <div className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
        Step {stepIndex + 1} of {total} · Glassbox tour
      </div>
      <h3 className="mt-2 text-[18px] tracking-tight leading-[1.25]">
        {title}
      </h3>
    </div>
  );
}

function Controls({
  isLast,
  canGoBack,
  onNext,
  onPrev,
  onSkip,
}: {
  isLast: boolean;
  canGoBack: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onSkip}
        className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]"
      >
        Skip tour
      </button>
      <div className="flex gap-2">
        {canGoBack && (
          <button
            type="button"
            onClick={onPrev}
            className="px-3 py-1.5 rounded-full border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[12px]"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="px-4 py-1.5 rounded-full bg-[var(--color-accent)] text-[var(--color-bg)] text-[12px] font-medium hover:opacity-90"
        >
          {isLast ? "Got it" : "Next →"}
        </button>
      </div>
    </div>
  );
}
