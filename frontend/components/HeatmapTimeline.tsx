"use client";

import { useRef, useCallback } from "react";
import type { HeatMarker } from "@/lib/api";
import { fmtTime } from "@/lib/format";

interface Clip {
  id: string;
  start: number;
  end: number;
  hotStart?: number;
  hotEnd?: number;
}

interface Props {
  heatmap: HeatMarker[];
  duration: number;
  clips: Clip[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (id: string, start: number, end: number) => void;
}

const H = 96;
const RED = "hsl(351 83% 59%)";
const ORANGE = "hsl(24 95% 55%)";

export default function HeatmapTimeline({
  heatmap,
  duration,
  clips,
  selectedId,
  onSelect,
  onChange,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; edge: "start" | "end" } | null>(null);

  const pxToTime = useCallback(
    (clientX: number): number => {
      const el = ref.current;
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      return ratio * duration;
    },
    [duration]
  );

  const onPointerDown =
    (id: string, edge: "start" | "end") => (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      drag.current = { id, edge };
      onSelect(id);
    };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const t = pxToTime(e.clientX);
    const clip = clips.find((c) => c.id === drag.current!.id);
    if (!clip) return;
    if (drag.current.edge === "start") {
      onChange(clip.id, Math.min(t, clip.end - 1), clip.end);
    } else {
      onChange(clip.id, clip.start, Math.max(t, clip.start + 1));
    }
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const points = heatmap.length
    ? heatmap.map((m, i) => {
        const x = (i / (heatmap.length - 1)) * 100;
        const y = H - m.value * (H - 10) - 5;
        return `${x},${y}`;
      })
    : [];
  const areaPath = points.length ? `M0,${H} L${points.join(" L")} L100,${H} Z` : "";
  const pct = (t: number) => `${(t / duration) * 100}%`;

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="relative select-none overflow-hidden rounded-2xl border border-border bg-muted/40"
      style={{ height: H, touchAction: "none" }}
    >
      {areaPath ? (
        <svg
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="heat-tl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={RED} stopOpacity="0.85" />
              <stop offset="100%" stopColor={ORANGE} stopOpacity="0.06" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#heat-tl)" stroke={RED} strokeWidth="0.6" />
        </svg>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          No heatmap for this video — drag to set clip times manually.
        </div>
      )}

      {/* Detected most-replayed bands (read-only reference) */}
      {clips.map((c) =>
        c.hotStart != null && c.hotEnd != null && c.hotEnd > c.hotStart ? (
          <div
            key={`hot-${c.id}`}
            title={`Most replayed: ${fmtTime(c.hotStart)}–${fmtTime(c.hotEnd)}`}
            className="pointer-events-none absolute bottom-0 h-1.5 rounded-full bg-amber-400"
            style={{
              left: pct(c.hotStart),
              width: pct(c.hotEnd - c.hotStart),
              boxShadow: "0 0 10px rgba(251,191,36,.85)",
            }}
          />
        ) : null
      )}

      {/* Clip regions + handles */}
      {clips.map((c) => {
        const isSel = c.id === selectedId;
        return (
          <div key={c.id}>
            <div
              onPointerDown={() => onSelect(c.id)}
              className="absolute cursor-pointer rounded-md transition-colors"
              style={{
                left: pct(c.start),
                width: pct(c.end - c.start),
                top: 0,
                bottom: 0,
                background: isSel ? "hsl(351 83% 59% / .16)" : "hsl(222 24% 10% / .06)",
                border: `1.5px solid ${isSel ? RED : "hsl(220 16% 78%)"}`,
              }}
            />
            {(["start", "end"] as const).map((edge) => (
              <div
                key={edge}
                onPointerDown={onPointerDown(c.id, edge)}
                title={`${edge}: ${fmtTime(edge === "start" ? c.start : c.end)}`}
                className="absolute rounded"
                style={{
                  left: `calc(${pct(edge === "start" ? c.start : c.end)} - 5px)`,
                  top: 0,
                  bottom: 0,
                  width: 10,
                  cursor: "ew-resize",
                  background: isSel ? RED : "hsl(220 9% 60%)",
                  opacity: isSel ? 1 : 0.55,
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
