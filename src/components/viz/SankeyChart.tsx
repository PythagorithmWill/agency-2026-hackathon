"use client";

import { useMemo } from "react";

export interface SankeyNode {
  id: string;
  label: string;
  /** "left" or "right" — which column the node sits in. */
  side: "left" | "right";
  total: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

interface Props {
  nodes: ReadonlyArray<SankeyNode>;
  links: ReadonlyArray<SankeyLink>;
  width?: number;
  height?: number;
  leftLabel?: string;
  rightLabel?: string;
  /** Optional: turns a node id into a click target. */
  hrefFor?: (node: SankeyNode) => string | null;
}

/**
 * Two-column Sankey diagram. Money flows left → right; band thickness
 * is proportional to flow value. Pure SVG, no external deps. Calibrated
 * for the Glassbox dark palette.
 *
 * The layout is intentionally simple: nodes are stacked vertically by
 * total in descending order; links are quadratic Bézier curves.
 *
 * For more than ~12 nodes per side the layout starts to crowd; consume
 * top-N data and aggregate the rest into an "Other" node.
 */
export function SankeyChart({
  nodes,
  links,
  width = 880,
  height = 440,
  leftLabel,
  rightLabel,
  hrefFor,
}: Props) {
  const layout = useMemo(() => computeLayout(nodes, links, width, height), [
    nodes,
    links,
    width,
    height,
  ]);

  if (nodes.length === 0 || links.length === 0) {
    return (
      <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-subtle)] py-12 text-center">
        No flow data.
      </div>
    );
  }

  const dollar = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div>
      {(leftLabel || rightLabel) && (
        <div className="mb-3 flex items-baseline justify-between font-[var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet">
        {/* Links (drawn first, behind nodes) */}
        <g>
          {layout.links.map((l, i) => (
            <path
              key={`l-${i}`}
              d={l.path}
              stroke={l.color}
              strokeWidth={l.thickness}
              fill="none"
              opacity={0.55}
            >
              <title>
                {l.sourceLabel} → {l.targetLabel}: {dollar(l.value)}
              </title>
            </path>
          ))}
        </g>
        {/* Nodes */}
        <g>
          {layout.nodes.map((n) => {
            const labelX = n.side === "left" ? n.x - 8 : n.x + 14;
            const anchor = n.side === "left" ? "end" : "start";
            const fill = n.side === "left" ? "#5EEAD4" : "#FBBF24";
            const inner = (
              <>
                <rect
                  x={n.x}
                  y={n.y}
                  width={6}
                  height={n.h}
                  fill={fill}
                  rx={1}
                />
                <text
                  x={labelX}
                  y={n.y + n.h / 2 + 4}
                  textAnchor={anchor}
                  className="fill-[var(--color-fg)]"
                  style={{ fontSize: 11.5, fontFamily: "var(--font-sans)" }}
                >
                  {truncate(n.label, 36)}
                </text>
                <text
                  x={labelX}
                  y={n.y + n.h / 2 + 18}
                  textAnchor={anchor}
                  className="fill-[var(--color-fg-subtle)]"
                  style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
                >
                  {dollar(n.total)}
                </text>
                <title>
                  {n.label} — {dollar(n.total)}
                </title>
              </>
            );
            const href = hrefFor ? hrefFor({ ...n }) : null;
            return href ? (
              <a key={n.id} href={href}>
                {inner}
              </a>
            ) : (
              <g key={n.id}>{inner}</g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

interface LaidOutNode extends SankeyNode {
  x: number;
  y: number;
  h: number;
}

interface LaidOutLink {
  path: string;
  thickness: number;
  color: string;
  value: number;
  sourceLabel: string;
  targetLabel: string;
}

interface Layout {
  nodes: LaidOutNode[];
  links: LaidOutLink[];
}

function computeLayout(
  nodes: ReadonlyArray<SankeyNode>,
  links: ReadonlyArray<SankeyLink>,
  width: number,
  height: number,
): Layout {
  const padX = 200; // room for labels at left & right
  const padY = 12;
  const colLeftX = padX;
  const colRightX = width - padX - 6;

  const left = nodes.filter((n) => n.side === "left").sort((a, b) => b.total - a.total);
  const right = nodes.filter((n) => n.side === "right").sort((a, b) => b.total - a.total);
  const leftTotal = left.reduce((s, n) => s + n.total, 0);
  const rightTotal = right.reduce((s, n) => s + n.total, 0);
  const usableH = height - padY * 2;

  const gap = 6;
  const leftHeight = (n: SankeyNode) => (n.total / Math.max(leftTotal, 1)) * (usableH - gap * (left.length - 1));
  const rightHeight = (n: SankeyNode) => (n.total / Math.max(rightTotal, 1)) * (usableH - gap * (right.length - 1));

  const leftPositions = new Map<string, { y: number; h: number }>();
  let y = padY;
  for (const n of left) {
    const h = leftHeight(n);
    leftPositions.set(n.id, { y, h });
    y += h + gap;
  }
  const rightPositions = new Map<string, { y: number; h: number }>();
  y = padY;
  for (const n of right) {
    const h = rightHeight(n);
    rightPositions.set(n.id, { y, h });
    y += h + gap;
  }

  const laidOutNodes: LaidOutNode[] = [
    ...left.map((n) => {
      const p = leftPositions.get(n.id)!;
      return { ...n, x: colLeftX, y: p.y, h: p.h };
    }),
    ...right.map((n) => {
      const p = rightPositions.get(n.id)!;
      return { ...n, x: colRightX, y: p.y, h: p.h };
    }),
  ];

  // Track cursor on each node so concurrent in/out flows stack vertically
  const leftCursor = new Map<string, number>(left.map((n) => [n.id, leftPositions.get(n.id)!.y]));
  const rightCursor = new Map<string, number>(right.map((n) => [n.id, rightPositions.get(n.id)!.y]));

  const PALETTE = ["#5EEAD4", "#FBBF24", "#F87171", "#A78BFA", "#94A3B8", "#52525B", "#34D399", "#F472B6"];
  const laidOutLinks: LaidOutLink[] = [];
  links.forEach((l, i) => {
    const sPos = leftPositions.get(l.source);
    const tPos = rightPositions.get(l.target);
    if (!sPos || !tPos) return;
    const sNode = left.find((n) => n.id === l.source)!;
    const tNode = right.find((n) => n.id === l.target)!;
    const thickness = Math.max(
      1,
      (l.value / Math.max(leftTotal, 1)) * (usableH - gap * (left.length - 1)),
    );
    const sy = (leftCursor.get(l.source) ?? sPos.y) + thickness / 2;
    const ty = (rightCursor.get(l.target) ?? tPos.y) + thickness / 2;
    leftCursor.set(l.source, (leftCursor.get(l.source) ?? sPos.y) + thickness);
    rightCursor.set(l.target, (rightCursor.get(l.target) ?? tPos.y) + thickness);

    const sx = colLeftX + 6;
    const tx = colRightX;
    const cx1 = sx + (tx - sx) * 0.5;
    const cx2 = sx + (tx - sx) * 0.5;
    const path = `M ${sx} ${sy.toFixed(1)} C ${cx1} ${sy.toFixed(1)}, ${cx2} ${ty.toFixed(1)}, ${tx} ${ty.toFixed(1)}`;
    laidOutLinks.push({
      path,
      thickness,
      color: PALETTE[i % PALETTE.length],
      value: l.value,
      sourceLabel: sNode.label,
      targetLabel: tNode.label,
    });
  });

  return { nodes: laidOutNodes, links: laidOutLinks };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
