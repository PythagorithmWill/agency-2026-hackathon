import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AnimatedBar } from "../AnimatedBar";
import { AnimatedDonut } from "../AnimatedDonut";
import { AnimatedAreaChart } from "../AnimatedAreaChart";
import { AnimatedSparkline } from "../AnimatedSparkline";
import { LorenzCurve } from "../LorenzCurve";
import { SankeyChart } from "../SankeyChart";
import { AnimatedNumber } from "../AnimatedNumber";
import { CountUp } from "../../motion/CountUp";
import { CharStaggerHeadline } from "../../motion/CharStaggerHeadline";
import { SuitabilityScoreCircle } from "../../evaluate/SuitabilityScoreCircle";
import { AmendmentTimeline } from "../../record/AmendmentTimeline";
import type { SuitabilityScore } from "@/lib/types";

// vitest transpiles JSX with the classic runtime here (root tsconfig has
// `jsx: "preserve"` and vitest.config.ts sets no esbuild.jsx), so the
// components' `React.createElement` calls need React in scope. Setting
// `esbuild: { jsx: "automatic" }` in vitest.config.ts would remove this.
(globalThis as { React?: typeof React }).React = React;

/**
 * Edge-case rendering for the pure-math viz components: empty input, a
 * single point, all-zero values, NaN/negative values, missing dates. A
 * NaN or "undefined" reaching an SVG attribute is what the browser logs
 * as "Error: <path> attribute d: Expected number", so every test scans
 * the rendered markup for those tokens.
 */
function expectNoBadSvgValues(container: HTMLElement) {
  const html = container.innerHTML;
  expect(html).not.toMatch(/NaN/);
  expect(html).not.toMatch(/undefined/);
  expect(html).not.toMatch(/Infinity/);
}

describe("AnimatedBar", () => {
  it("renders nothing harmful for empty rows", () => {
    const { container } = render(<AnimatedBar rows={[]} />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });
  it("handles all-zero and negative values without NaN widths", () => {
    const { container } = render(
      <AnimatedBar rows={[{ label: "a", value: 0 }, { label: "b", value: -5 }]} />,
    );
    expectNoBadSvgValues(container);
    expect(container.textContent).toContain("$0");
  });
  it("formats very large values compactly", () => {
    const { container } = render(
      <AnimatedBar rows={[{ label: "x".repeat(400), value: 12_345_678_901 }]} />,
    );
    expect(container.textContent).toContain("$12.3B");
  });
});

describe("AnimatedDonut", () => {
  it("renders 0% legend entries when every slice is zero", () => {
    const { container } = render(
      <AnimatedDonut slices={[{ label: "a", value: 0 }, { label: "b", value: 0 }]} />,
    );
    expectNoBadSvgValues(container);
    expect(container.textContent).toContain("0%");
  });
  it("treats NaN and negative slices as zero", () => {
    const { container } = render(
      <AnimatedDonut slices={[{ label: "a", value: Number.NaN }, { label: "b", value: -3 }, { label: "c", value: 3 }]} />,
    );
    expectNoBadSvgValues(container);
    expect(container.textContent).toContain("100%");
  });
  it("renders an empty legend for no slices", () => {
    const { container } = render(<AnimatedDonut slices={[]} />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });
});

describe("AnimatedAreaChart", () => {
  it("shows the insufficient-series message for a single point", () => {
    const { container } = render(<AnimatedAreaChart historical={[{ fy: 2020, value: 1 }]} />);
    expect(container.textContent).toMatch(/Insufficient/);
  });
  it("does not crash when there is a forecast but no history", () => {
    const { container } = render(
      <AnimatedAreaChart
        historical={[]}
        forecast={[
          { fy: 2025, predicted: 1, lowerBound: 0, upperBound: 2 },
          { fy: 2026, predicted: 1, lowerBound: 0, upperBound: 2 },
        ]}
      />,
    );
    expect(container.textContent).toMatch(/Insufficient/);
  });
  it("handles all-zero series without NaN", () => {
    const { container } = render(
      <AnimatedAreaChart historical={[{ fy: 2020, value: 0 }, { fy: 2021, value: 0 }]} />,
    );
    expectNoBadSvgValues(container);
    expect(container.querySelector("path")).not.toBeNull();
  });
});

describe("AnimatedSparkline", () => {
  it("handles a single point and all-zero values", () => {
    const one = render(<AnimatedSparkline points={[{ fy: 2020, value: 5 }]} />);
    expect(one.container.textContent).toMatch(/Insufficient/);
    const zero = render(
      <AnimatedSparkline points={[{ fy: 2020, value: 0 }, { fy: 2020, value: 0 }]} />,
    );
    expectNoBadSvgValues(zero.container);
  });
});

describe("LorenzCurve", () => {
  it("renders with an empty decile breakdown and a non-finite gini", () => {
    const { container } = render(<LorenzCurve decileBreakdown={[]} gini={Number.NaN} />);
    expectNoBadSvgValues(container);
    expect(container.textContent).toContain("Gini = —");
  });
  it("prints the gini when finite", () => {
    const { container } = render(
      <LorenzCurve decileBreakdown={[{ decile: 10, share: 1 }]} gini={0.85} />,
    );
    expect(container.textContent).toContain("Gini = 0.85");
  });
});

describe("SankeyChart", () => {
  it("shows the empty state for no links", () => {
    const { container } = render(<SankeyChart nodes={[]} links={[]} />);
    expect(container.textContent).toMatch(/No flow data/);
  });
  it("handles zero totals and dangling links without NaN", () => {
    const { container } = render(
      <SankeyChart
        nodes={[
          { id: "a", label: "A", side: "left", total: 0 },
          { id: "b", label: "B", side: "right", total: 0 },
        ]}
        links={[
          { source: "a", target: "b", value: 0 },
          { source: "missing", target: "b", value: 5 },
        ]}
      />,
    );
    expectNoBadSvgValues(container);
    expect(container.querySelectorAll("path")).toHaveLength(1);
  });
});

describe("count-ups", () => {
  it("AnimatedNumber renders the final value immediately when animate=false", () => {
    const { container } = render(<AnimatedNumber value={1234} animate={false} />);
    expect(container.textContent).toBe("1,234");
  });
  it("CountUp renders a numeric string on first paint", () => {
    const { container } = render(<CountUp to={14} />);
    expect(container.textContent).toMatch(/^\d+$/);
  });
});

describe("CharStaggerHeadline", () => {
  it("keeps whole words together so lines break only at spaces", () => {
    const { container } = render(<CharStaggerHeadline text="Northern community" />);
    const words = container.querySelectorAll("h1 > span.whitespace-nowrap");
    expect(words).toHaveLength(2);
    expect(words[0].textContent).toBe("Northern");
    expect(words[1].textContent).toBe("community");
    expect(container.querySelector("h1")?.getAttribute("aria-label")).toBe("Northern community");
    expect(container.querySelector("h1")?.textContent).toBe("Northern community");
  });
});

describe("SuitabilityScoreCircle", () => {
  const score: SuitabilityScore = {
    composite: 18,
    verdict: "PROCEED",
    uniqueness: 7,
    duplicationRisk: 2,
    recipientConcentration: 3,
    languageCalibration: 8,
    perComponentExplanation: {
      uniqueness: "",
      duplicationRisk: "",
      recipientConcentration: "",
      languageCalibration: "",
    },
  } as unknown as SuitabilityScore;

  it("renders the composite as plain SVG text (no HTML inside <text>) with rounded arcs", () => {
    const { container } = render(
      <SuitabilityScoreCircle score={score} explanation={score.perComponentExplanation} />,
    );
    expect(container.querySelector("svg text span")).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("height")).toBeNull();
    for (const p of container.querySelectorAll("svg path")) {
      // Two decimals max — Node and Chrome print floats differently past that.
      expect(p.getAttribute("d")).not.toMatch(/\d\.\d{3,}/);
    }
    expect(container.textContent).toContain("/ 30");
  });
});

describe("AmendmentTimeline", () => {
  it("survives null and unparseable dates", () => {
    const { container } = render(
      <AmendmentTimeline
        events={[
          { amendmentNumber: 0, date: null, agreementValue: 100 },
          { amendmentNumber: 1, date: "not a date", agreementValue: 200 },
          { amendmentNumber: 2, date: "2024-01-01", agreementValue: -5 },
        ] as never}
      />,
    );
    expectNoBadSvgValues(container);
    expect(container.querySelectorAll("circle")).toHaveLength(3);
  });
  it("shows the empty state for no events", () => {
    const { container } = render(<AmendmentTimeline events={[]} />);
    expect(container.textContent).toMatch(/No amendment chain/);
  });
});
