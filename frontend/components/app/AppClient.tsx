"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Loader2,
  Plus,
  Sparkles,
  Flame,
  Check,
  Play,
  Scissors,
  Activity,
  Type,
  Wand2,
  Maximize2,
  X,
  ChevronUp,
  ChevronDown,
  Lock,
  Eye,
} from "lucide-react";
import HeatmapTimeline from "@/components/HeatmapTimeline";
import { AppBar } from "@/components/app/AppBar";
import { PhoneFrame } from "@/components/app/PhoneFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  analyze,
  getJob,
  me,
  preview,
  render,
  type AnalyzeResult,
  type JobStatus,
} from "@/lib/api";
import { fmtTime, parseTime } from "@/lib/format";
import { sfx } from "@/lib/audio";

// Client-side mirror of the server's plan limits (server still enforces).
const PLAN_MAX_QUALITY: Record<string, string> = {
  free: "1080p",
  creator: "2k",
  studio: "4k",
  admin: "4k",
};
function planAllowsQuality(plan: string, id: string): boolean {
  const order = ["720p", "1080p", "2k", "4k"];
  const max = PLAN_MAX_QUALITY[plan] ?? "1080p";
  return order.indexOf(id) <= order.indexOf(max);
}
const planAllowsAutoframe = (plan: string) => plan !== "free";

interface Clip {
  id: string;
  start: number;
  end: number;
  recStart: number; // our recommended (wave-derived) bounds — for "Recommended" mode
  recEnd: number;
  hotStart: number;
  hotEnd: number;
  hookText: string;
  reason: string;
  score: number;
  source: string;
  include: boolean;
}

type Phase = "input" | "analyzing" | "editing" | "rendering" | "results";
type LengthMode = "auto" | number;

const LENGTH_PRESETS = [30, 45, 60, 90, 120];
const QUALITY_OPTIONS: { id: string; label: string; note?: string; pro?: boolean }[] = [
  { id: "720p", label: "720p" },
  { id: "1080p", label: "1080p", note: "HD" },
  { id: "2k", label: "2K", pro: true },
  { id: "4k", label: "4K", pro: true },
];
// Minimum source height each tier needs to be real (not upscaled).
const QUALITY_NOMINAL: Record<string, number> = {
  "720p": 720,
  "1080p": 1080,
  "2k": 1440,
  "4k": 2160,
};

function availableQualities(maxHeight: number) {
  if (!maxHeight) return QUALITY_OPTIONS; // unknown → show all
  const avail = QUALITY_OPTIONS.filter((q) => QUALITY_NOMINAL[q.id] <= maxHeight);
  return avail.length ? avail : [QUALITY_OPTIONS[0]];
}

const SAMPLES = [
  { label: "TED talk", url: "https://www.youtube.com/watch?v=arj7oStGLkU" },
  { label: "Music video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
];

const STEPS = [
  { icon: Activity, label: "Reading the most-replayed heatmap" },
  { icon: Type, label: "Pulling the transcript" },
  { icon: Flame, label: "Finding the hottest moments" },
  { icon: Wand2, label: "Writing hooks & clip lengths" },
];

/* ---------- small bits ---------- */

function HotRing({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-11 w-11 place-items-center">
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="hsl(220 16% 90%)" strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="url(#ringheat)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (value * c)}
        />
        <defs>
          <linearGradient id="ringheat" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(351 83% 59%)" />
            <stop offset="100%" stopColor="hsl(24 95% 55%)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-[10px] font-bold tabular-nums">{pct}</span>
    </div>
  );
}

// Branded render loader: flickering flame over a heatmap "equalizer" that pulses
// in the heat gradient — our own animated graphic instead of a generic spinner.
const EQ_HEIGHTS = [0.5, 0.8, 0.4, 1, 0.65, 0.9, 0.55, 0.75];

function RenderRing({ label }: { label: string }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-b from-zinc-900 to-black">
      {/* soft glow */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-24 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,hsl(24_95%_55%/.22),transparent_70%)]" />
      <Flame className="h-6 w-6 animate-flame text-amber-400" />
      <div className="flex h-14 items-end gap-1.5">
        {EQ_HEIGHTS.map((h, i) => (
          <span
            key={i}
            className="w-1.5 flex-none rounded-full bg-gradient-to-t from-[hsl(24_95%_55%)] to-[hsl(351_83%_62%)] animate-eq"
            style={{ height: `${h * 100}%`, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
      <span className="text-xs font-medium capitalize text-white/70">{label}…</span>
    </div>
  );
}

/* ---------- main ---------- */

export function AppClient() {
  const params = useSearchParams();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyzeResult | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lengthMode, setLengthMode] = useState<LengthMode>("auto");
  const [quality, setQuality] = useState("1080p");
  const [autoFrame, setAutoFrame] = useState(true);
  const [reframeNudge, setReframeNudge] = useState(0); // -0.2..0.2 horizontal shift
  const [captions, setCaptions] = useState(true);
  const [captionTheme, setCaptionTheme] = useState("karaoke");
  const [plan, setPlan] = useState("free");
  const [job, setJob] = useState<JobStatus | null>(null);
  const [reelIdx, setReelIdx] = useState<number | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Finished clips form the swipeable reel feed.
  const playable = job
    ? job.clips.filter((c) => c.status === "done" && c.clip_url)
    : [];

  const stepReel = (delta: number) =>
    setReelIdx((i) =>
      i === null || playable.length === 0
        ? i
        : (i + delta + playable.length) % playable.length
    );
  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runAnalyze = useCallback(async (link: string) => {
    setError(null);
    setPhase("analyzing");
    setStep(0);
    sfx.whoosh();
    stepRef.current = setInterval(
      () => setStep((s) => Math.min(STEPS.length - 1, s + 1)),
      850
    );
    try {
      const res = await analyze(link);
      if (stepRef.current) clearInterval(stepRef.current);
      setData(res);
      const cs: Clip[] = res.candidates.map((c, i) => ({
        id: `c${i}`,
        start: c.start,
        end: c.end,
        recStart: c.start,
        recEnd: c.end,
        hotStart: c.hotStart,
        hotEnd: c.hotEnd,
        hookText: c.hookText,
        reason: c.reason,
        score: c.score,
        source: c.source,
        include: true,
      }));
      setClips(cs);
      setSelectedId(cs[0]?.id ?? null);
      setLengthMode("auto");
      // Default quality to the best the source actually supports (cap at 1080p).
      const avail = availableQualities(res.maxHeight || 0);
      const def = avail.find((q) => q.id === "1080p") ?? avail[avail.length - 1];
      setQuality(def.id);
      setPhase("editing");
      sfx.success();
    } catch (e: any) {
      if (stepRef.current) clearInterval(stepRef.current);
      setError(e.message || "Something went wrong");
      setPhase("input");
    }
  }, []);

  useEffect(() => {
    const q = params.get("url");
    if (q) {
      setUrl(q);
      runAnalyze(q);
    }
    // load the signed-in user's plan to gate PRO features (server also enforces)
    me().then((u) => {
      if (u) {
        setPlan(u.plan);
        if (!planAllowsAutoframe(u.plan)) setAutoFrame(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (stepRef.current) clearInterval(stepRef.current);
    },
    []
  );

  // Keyboard nav for the reel viewer (↑/↓ or ←/→ to move, Esc to close).
  useEffect(() => {
    if (reelIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReelIdx(null);
      else if (e.key === "ArrowDown" || e.key === "ArrowRight") stepReel(1);
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") stepReel(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reelIdx, playable.length]);

  function updateClip(id: string, patch: Partial<Clip>) {
    setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  // Apply a target length to every clip. "auto" restores our recommendation;
  // a preset centres the clip on its most-replayed span at that fixed length.
  function applyLength(mode: LengthMode) {
    setLengthMode(mode);
    sfx.click();
    const dur = data?.duration ?? Infinity;
    setClips((cs) =>
      cs.map((c) => {
        if (mode === "auto") return { ...c, start: c.recStart, end: c.recEnd };
        const mid =
          c.hotEnd > c.hotStart
            ? (c.hotStart + c.hotEnd) / 2
            : (c.recStart + c.recEnd) / 2;
        let start = Math.max(0, mid - mode / 2);
        let end = Math.min(dur, start + mode);
        start = Math.max(0, end - mode);
        return { ...c, start, end };
      })
    );
  }

  function addManualClip() {
    if (!data) return;
    const sel = clips.find((x) => x.id === selectedId);
    const start = Math.min(data.duration - 15, sel ? sel.start : 0);
    const id = `m${Date.now()}`;
    setClips((cs) => [
      ...cs,
      {
        id,
        start,
        end: Math.min(data.duration, start + 20),
        recStart: start,
        recEnd: Math.min(data.duration, start + 20),
        hotStart: 0,
        hotEnd: 0,
        hookText: "Manual clip",
        reason: "Custom timing",
        score: 0,
        source: "manual",
        include: true,
      },
    ]);
    setSelectedId(id);
    sfx.click();
  }

  async function onRender() {
    if (!data) return;
    const chosen = clips.filter((c) => c.include);
    if (!chosen.length) return;
    setError(null);
    sfx.success();
    try {
      const { jobId } = await render(
        data.webpageUrl,
        chosen.map((c) => ({ start: c.start, end: c.end })),
        quality,
        autoFrame,
        autoFrame ? reframeNudge : 0,
        captions,
        captionTheme
      );
      setPhase("rendering");
      pollRef.current = setInterval(async () => {
        try {
          const j = await getJob(jobId);
          setJob(j);
          if (j.status === "done" || j.status === "error") {
            if (pollRef.current) clearInterval(pollRef.current);
            setPhase("results");
          }
        } catch {
          /* keep polling */
        }
      }, 1500);
    } catch (e: any) {
      setError(e.message || "Render failed");
    }
  }

  async function previewClip(c: Clip) {
    if (!data || previewingId) return;
    setPreviewingId(c.id);
    setPreviewUrl(null);
    sfx.click();
    try {
      const { jobId } = await preview(
        data.webpageUrl,
        { start: c.start, end: c.end },
        autoFrame && planAllowsAutoframe(plan),
        autoFrame ? reframeNudge : 0,
        captions,
        captionTheme
      );
      previewPollRef.current = setInterval(async () => {
        try {
          const j = await getJob(jobId);
          const clip = j.clips[0];
          if (clip?.status === "done" && clip.clip_url) {
            if (previewPollRef.current) clearInterval(previewPollRef.current);
            setPreviewUrl(clip.clip_url);
            setPreviewingId(null);
          } else if (j.status === "error" || clip?.status === "error") {
            if (previewPollRef.current) clearInterval(previewPollRef.current);
            setPreviewingId(null);
          }
        } catch {
          /* keep polling */
        }
      }, 1500);
    } catch {
      setPreviewingId(null);
    }
  }

  function reset() {
    if (previewPollRef.current) clearInterval(previewPollRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase("input");
    setData(null);
    setClips([]);
    setJob(null);
    setError(null);
    setUrl("");
  }

  const includedCount = clips.filter((c) => c.include).length;

  return (
    <div className="min-h-screen">
      <AppBar />

      {/* ---------------- PASTE ---------------- */}
      {phase === "input" && (
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 bg-grid" />
          <div className="container relative flex flex-col items-center py-20 text-center">
            <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-heat text-white shadow-glow">
              <Flame className="h-7 w-7 animate-flame" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Drop a video, get <span className="heat-text">Shorts</span>
            </h1>
            <p className="mt-3 max-w-md text-muted-foreground">
              Paste any YouTube link. HeatClip finds the most-replayed moments and
              turns them into ready-to-post vertical clips.
            </p>

            <div className="mt-8 w-full max-w-xl">
              <div className="flex items-center rounded-2xl border border-border bg-card p-1.5 shadow-soft focus-within:ring-2 focus-within:ring-ring">
                <span className="grid h-11 w-11 shrink-0 place-items-center text-muted-foreground">
                  <Play className="h-4 w-4 fill-current" />
                </span>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && url && runAnalyze(url)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <Button onClick={() => runAnalyze(url)} disabled={!url} className="shrink-0">
                  Analyze <ArrowRight />
                </Button>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>Try:</span>
                {SAMPLES.map((s) => (
                  <button
                    key={s.url}
                    onClick={() => {
                      setUrl(s.url);
                      runAnalyze(s.url);
                    }}
                    className="rounded-full border border-border bg-muted/50 px-3 py-1 font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- ANALYZING ---------------- */}
      {phase === "analyzing" && (
        <div className="container flex flex-col items-center py-24">
          <div className="relative mb-10 grid h-20 w-20 place-items-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-heat/30" />
            <div className="grid h-20 w-20 place-items-center rounded-full bg-heat text-white shadow-glow">
              <Flame className="h-8 w-8" />
            </div>
          </div>
          <h2 className="text-xl font-bold">Analyzing your video…</h2>
          <p className="mt-1 text-sm text-muted-foreground">This takes a few seconds.</p>
          <div className="mt-8 w-full max-w-sm space-y-3">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                    active
                      ? "border-primary/40 bg-primary/5"
                      : done
                      ? "border-border bg-card"
                      : "border-border bg-muted/40 opacity-60"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      done
                        ? "bg-emerald-100 text-emerald-600"
                        : active
                        ? "bg-heat text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : active ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <s.icon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- EDITOR HEADER + TIMELINE ---------------- */}
      {(phase === "editing" || phase === "rendering" || phase === "results") && data && (
        <div className="container max-w-5xl py-8">
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>

          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center">
            {data.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.thumbnail}
                alt=""
                className="h-20 w-36 shrink-0 rounded-xl object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold">{data.title}</h2>
              <p className="text-sm text-muted-foreground">
                {data.channel} · {fmtTime(data.duration)}
              </p>
            </div>
            <Badge variant="heat" className="self-start sm:self-center">
              <Flame className="h-3 w-3" /> {clips.length} hot moment
              {clips.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {!data.hasHeatmap && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No “most replayed” heatmap for this video yet — we suggested moments from
              the transcript. Drag the handles to adjust.
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Replay heatmap
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-4 rounded-full bg-amber-400" /> most replayed ·
                drag to trim
              </span>
            </div>
            <HeatmapTimeline
              heatmap={data.heatmap}
              duration={data.duration}
              clips={clips}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={(id, start, end) => updateClip(id, { start, end })}
            />
            <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
              <span>0:00</span>
              <span>{fmtTime(data.duration / 2)}</span>
              <span>{fmtTime(data.duration)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- PICK SHORTS ---------------- */}
      {phase === "editing" && data && (
        <div className="container max-w-5xl pb-32">
          <div className="mb-3 mt-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Pick your Shorts
            </h3>
            <Button variant="outline" size="sm" onClick={addManualClip}>
              <Plus /> Add clip
            </Button>
          </div>

          {/* Clip settings: length (our recommendation + presets) and export quality */}
          <div className="mb-4 space-y-2.5 rounded-2xl border border-border bg-card p-3 shadow-soft">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-xs font-medium text-muted-foreground">
                Clip length
              </span>
              <button
                onClick={() => applyLength("auto")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  lengthMode === "auto"
                    ? "bg-heat text-white shadow-glow"
                    : "border border-border bg-muted/50 text-foreground hover:bg-muted"
                }`}
              >
                <Sparkles className="h-3 w-3" /> Recommended
              </button>
              {LENGTH_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => applyLength(p)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums transition-all ${
                    lengthMode === p
                      ? "bg-foreground text-background"
                      : "border border-border bg-muted/50 text-foreground hover:bg-muted"
                  }`}
                >
                  {p}s
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
              <span className="w-20 text-xs font-medium text-muted-foreground">
                Quality
              </span>
              {availableQualities(data.maxHeight || 0).map((q) => {
                const locked = !planAllowsQuality(plan, q.id);
                return (
                  <button
                    key={q.id}
                    disabled={locked}
                    title={locked ? "Upgrade to unlock" : undefined}
                    onClick={() => {
                      if (locked) return;
                      setQuality(q.id);
                      sfx.click();
                    }}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums transition-all ${
                      quality === q.id
                        ? "bg-heat text-white shadow-glow"
                        : locked
                        ? "cursor-not-allowed border border-border bg-muted/30 text-muted-foreground/60"
                        : "border border-border bg-muted/50 text-foreground hover:bg-muted"
                    }`}
                  >
                    {q.label}
                    {q.note && (
                      <span
                        className={
                          quality === q.id ? "opacity-80" : "text-muted-foreground"
                        }
                      >
                        {q.note}
                      </span>
                    )}
                    {locked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      q.pro && (
                        <span
                          className={`rounded px-1 text-[9px] font-bold ${
                            quality === q.id
                              ? "bg-white/25 text-white"
                              : "bg-amber-400/20 text-amber-600"
                          }`}
                        >
                          PRO
                        </span>
                      )
                    )}
                  </button>
                );
              })}
              <span className="ml-auto hidden text-[11px] text-muted-foreground sm:block">
                {data.maxHeight >= 720
                  ? `Max quality for this video: ${data.maxHeight}p`
                  : "Vertical 9:16"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-2.5">
              <span className="w-20 text-xs font-medium text-muted-foreground">
                Reframe
              </span>
              <Switch
                checked={autoFrame && planAllowsAutoframe(plan)}
                disabled={!planAllowsAutoframe(plan)}
                onCheckedChange={(v) => {
                  setAutoFrame(v);
                  sfx.hover();
                }}
              />
              <span className="text-sm font-medium">Auto-reframe subject</span>
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-400/20 px-1 text-[9px] font-bold text-amber-600">
                {!planAllowsAutoframe(plan) && <Lock className="h-2.5 w-2.5" />} PRO
              </span>

              {autoFrame && planAllowsAutoframe(plan) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Nudge</span>
                  <div className="flex overflow-hidden rounded-lg border border-border">
                    {[-0.2, -0.1, 0, 0.1, 0.2].map((v, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setReframeNudge(v);
                          sfx.hover();
                        }}
                        title={v < 0 ? "Shift left" : v > 0 ? "Shift right" : "Center"}
                        className={`h-7 w-7 text-xs font-semibold transition-colors ${
                          reframeNudge === v
                            ? "bg-heat text-white"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {v < 0 ? (i === 0 ? "«" : "‹") : v > 0 ? (i === 4 ? "»" : "›") : "•"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <span className="ml-auto hidden text-[11px] text-muted-foreground sm:block">
                {!planAllowsAutoframe(plan)
                  ? "Upgrade to auto-follow the speaker"
                  : autoFrame
                  ? "Follows the speaker · nudge if it frames the wrong side"
                  : "Simple center-crop"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-2.5">
              <span className="w-20 text-xs font-medium text-muted-foreground">
                Captions
              </span>
              <Switch
                checked={captions}
                onCheckedChange={(v) => {
                  setCaptions(v);
                  sfx.hover();
                }}
              />
              <span className="text-sm font-medium">Burn animated captions</span>

              {captions && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {["karaoke", "hormozi", "neon", "classic", "minimal"].map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setCaptionTheme(t);
                        sfx.hover();
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-all ${
                        captionTheme === t
                          ? "bg-heat text-white shadow-glow"
                          : "border border-border bg-muted/50 text-foreground hover:bg-muted"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              <span className="ml-auto hidden text-[11px] text-muted-foreground sm:block">
                {captions ? "Word-by-word, spoken-word highlight" : "No captions"}
              </span>
            </div>
          </div>

          <div className="grid gap-3">
            {clips.map((c) => {
              const isSel = c.id === selectedId;
              const len = Math.round(c.end - c.start);
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedId(c.id);
                    sfx.hover();
                  }}
                  className={`group flex cursor-pointer items-center gap-4 rounded-2xl border bg-card p-4 shadow-soft transition-all ${
                    isSel ? "border-primary/50 ring-2 ring-ring/40" : "hover:border-primary/30"
                  } ${c.include ? "" : "opacity-60"}`}
                >
                  {/* thumbnail */}
                  <div className="relative hidden aspect-[9/16] h-24 shrink-0 overflow-hidden rounded-lg bg-zinc-900 sm:block">
                    {data.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.thumbnail}
                        alt=""
                        className="h-full w-full scale-[1.8] object-cover opacity-80"
                      />
                    )}
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                      {len}s
                    </span>
                    <span className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/20 backdrop-blur">
                      <Play className="h-3 w-3 fill-white text-white" />
                    </span>
                  </div>

                  {/* hot ring */}
                  {c.source === "manual" ? (
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                      <Scissors className="h-4 w-4" />
                    </div>
                  ) : (
                    <HotRing value={c.score} />
                  )}

                  {/* text + controls */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {c.source === "ai" && (
                        <Badge variant="ai">
                          <Sparkles className="h-3 w-3" /> AI hook
                        </Badge>
                      )}
                      <p className="truncate text-sm font-semibold">
                        “{c.hookText || "no transcript"}”
                      </p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.reason}
                    </p>
                    <div
                      className="mt-2 flex flex-wrap items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-2 py-1">
                        <Input
                          key={`s${c.id}${c.start}`}
                          defaultValue={fmtTime(c.start)}
                          onBlur={(e) => {
                            const t = parseTime(e.target.value);
                            if (t !== null) updateClip(c.id, { start: Math.max(0, t) });
                          }}
                          className="h-6 w-14 border-0 bg-transparent p-0 text-center text-xs shadow-none tabular-nums focus-visible:ring-0"
                        />
                        <span className="text-muted-foreground">→</span>
                        <Input
                          key={`e${c.id}${c.end}`}
                          defaultValue={fmtTime(c.end)}
                          onBlur={(e) => {
                            const t = parseTime(e.target.value);
                            if (t !== null) updateClip(c.id, { end: t });
                          }}
                          className="h-6 w-14 border-0 bg-transparent p-0 text-center text-xs shadow-none tabular-nums focus-visible:ring-0"
                        />
                      </div>
                      <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground tabular-nums">
                        {len}s
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex shrink-0 items-center gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* quick preview */}
                    <button
                      onClick={() => previewClip(c)}
                      disabled={!!previewingId}
                      title="Quick preview (low-res)"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    >
                      {previewingId === c.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                    {/* include toggle */}
                    <div className="flex flex-col items-center gap-1">
                      <Switch
                        checked={c.include}
                        onCheckedChange={(v) => {
                          updateClip(c.id, { include: v });
                          sfx.hover();
                        }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {c.include ? "in" : "off"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

          {/* sticky action bar */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-md">
            <div className="container flex max-w-5xl items-center justify-between py-3">
              <div className="flex items-center gap-2 text-sm">
                <span>
                  <span className="font-semibold">{includedCount}</span>{" "}
                  <span className="text-muted-foreground">
                    clip{includedCount === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold uppercase text-muted-foreground">
                  {quality}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={reset}>
                  Start over
                </Button>
                <Button onClick={onRender} disabled={includedCount === 0}>
                  <Flame /> Generate {includedCount} Short{includedCount === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- VIDEO GENERATOR / RESULTS ---------------- */}
      {(phase === "rendering" || phase === "results") && job && (
        <div className="container max-w-5xl pb-24">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {phase === "rendering"
                ? `Rendering ${job.progress.done}/${job.progress.total} Shorts`
                : "Your Shorts are ready"}
            </h3>
            {phase === "results" && (
              <Button variant="outline" size="sm" onClick={reset}>
                <Plus /> New video
              </Button>
            )}
          </div>

          {phase === "rendering" && (
            <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-heat transition-all duration-500"
                style={{
                  width: `${(job.progress.done / Math.max(1, job.progress.total)) * 100}%`,
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
            {job.clips.map((c) => (
              <div key={c.index} className="flex flex-col gap-2">
                <PhoneFrame>
                  {c.status === "done" && c.clip_url ? (
                    <>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video
                        src={c.clip_url}
                        controls
                        playsInline
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={() => {
                          const idx = playable.findIndex(
                            (p) => p.clip_url === c.clip_url
                          );
                          setReelIdx(idx < 0 ? 0 : idx);
                          sfx.click();
                        }}
                        title="Watch as a reel"
                        className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : c.status === "error" ? (
                    <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-white/60">
                      Failed: {c.error?.slice(0, 50)}
                    </div>
                  ) : (
                    <RenderRing label={c.status} />
                  )}
                </PhoneFrame>
                {c.status === "done" && c.clip_url ? (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <a href={c.clip_url} download onClick={() => sfx.click()}>
                      <Download /> Download
                    </a>
                  </Button>
                ) : (
                  <div className="h-9 rounded-full bg-muted/50" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick preview modal (single low-res clip) */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">
              Low-res preview · check framing
            </span>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={previewUrl}
              autoPlay
              controls
              playsInline
              loop
              className="h-[80vh] max-h-[80vh] w-auto max-w-full rounded-3xl shadow-2xl"
            />
          </div>
          <button
            onClick={() => setPreviewUrl(null)}
            aria-label="Close"
            className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Reel viewer — swipeable vertical feed, fills screen height like TikTok */}
      {reelIdx !== null && playable[reelIdx]?.clip_url && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setReelIdx(null)}
          onTouchStart={(e) => {
            touchStartY.current = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            if (touchStartY.current === null) return;
            const dy = e.changedTouches[0].clientY - touchStartY.current;
            if (dy < -50) stepReel(1);
            else if (dy > 50) stepReel(-1);
            touchStartY.current = null;
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            key={reelIdx}
            src={playable[reelIdx].clip_url!}
            autoPlay
            controls
            playsInline
            loop
            onClick={(e) => e.stopPropagation()}
            className="h-[92vh] max-h-[92vh] w-auto max-w-full rounded-3xl shadow-2xl"
          />

          {/* counter */}
          {playable.length > 1 && (
            <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {reelIdx + 1} / {playable.length}
            </div>
          )}

          {/* close */}
          <button
            onClick={() => setReelIdx(null)}
            aria-label="Close"
            className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {/* prev / next (TikTok-style, right edge) */}
          {playable.length > 1 && (
            <div
              className="absolute right-5 top-1/2 flex -translate-y-1/2 flex-col gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => stepReel(-1)}
                aria-label="Previous clip"
                className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-heat"
              >
                <ChevronUp className="h-5 w-5" />
              </button>
              <button
                onClick={() => stepReel(1)}
                aria-label="Next clip"
                className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-heat"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* download current */}
          <a
            href={playable[reelIdx].clip_url!}
            download
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            <Download className="h-4 w-4" /> Download
          </a>
        </div>
      )}
    </div>
  );
}
