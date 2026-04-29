"use client";

import { useEffect, useState } from "react";

type Status = "ok" | "degraded" | "down" | "checking";

/**
 * Footer status pill — pings /api/health on mount and shows a small
 * coloured dot + label. Green dot when all sources are ok, amber when
 * one is degraded, coral when down. Checking state on initial mount.
 */
export function DataSourceStatusPill() {
  const [status, setStatus] = useState<Status>("checking");
  const [breakdown, setBreakdown] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const sources = ["fed", "ab_grants", "ab_contracts", "general", "cra"] as const;
        const states = sources.map((s) => data[s]?.status as Status);
        const overall: Status = states.includes("down")
          ? "down"
          : states.includes("degraded")
            ? "degraded"
            : "ok";
        setStatus(overall);
        const liveCount = states.filter((s) => s === "ok").length;
        setBreakdown(`${liveCount}/${sources.length} live`);
      })
      .catch(() => {
        if (!cancelled) setStatus("down");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const color =
    status === "ok"
      ? "var(--color-accent)"
      : status === "degraded"
        ? "var(--color-accent-warm, #F5C36F)"
        : status === "down"
          ? "var(--color-accent-warn, #E8704F)"
          : "var(--color-fg-subtle)";

  const label =
    status === "checking"
      ? "Checking sources…"
      : status === "ok"
        ? `Federal · AB · ${breakdown || "live"}`
        : status === "degraded"
          ? `Degraded · ${breakdown}`
          : "Sources unreachable";

  return (
    <span
      className="inline-flex items-center gap-2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)]"
      title={label}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}40` }}
      />
      {label}
    </span>
  );
}
