"""Turn the heatmap + transcript into hook-led clip candidates.

Duration is derived from the WAVE, never a fixed default. We use two thresholds
(hysteresis):
  * CORE  — the strong "most-replayed" span (drawn as the amber band).
  * EXTEND — a lower shoulder threshold; the clip grows outward along the curve
    until the wave drops below it. So a sharp spike yields a short clip and a
    sustained plateau yields a long one — the length matches how long the moment
    actually stays interesting.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Optional

from analyzer import Caption, HeatMarker, VideoAnalysis

# Safety bounds only — the real duration comes from the wave, not these.
MIN_CLIP = 10.0
MAX_CLIP = 60.0
LEAD_IN = 1.0

CORE_RATIO = 0.55   # of peak value → the strong most-replayed span
EXTEND_RATIO = 0.42  # of peak value → grow the clip outward to this shoulder
MODEL = "claude-sonnet-4-6"


@dataclass
class Region:
    start: float        # wave-following clip start (variable duration)
    end: float          # wave-following clip end
    core_start: float   # strong most-replayed span start (amber band)
    core_end: float     # strong most-replayed span end
    centroid: float     # value-weighted center
    area: float         # ranking signal (sustained replays)
    peak: float         # max value 0..1


@dataclass
class Candidate:
    start: float
    end: float
    hot_start: float
    hot_end: float
    hook_text: str
    score: float
    source: str = "heatmap"
    reason: str = ""

    def as_dict(self) -> dict:
        return {
            "start": round(self.start, 2),
            "end": round(self.end, 2),
            "hotStart": round(self.hot_start, 2),
            "hotEnd": round(self.hot_end, 2),
            "durationSuggested": round(self.end - self.start, 1),
            "hookText": self.hook_text,
            "score": round(self.score, 3),
            "source": self.source,
            "reason": self.reason,
        }


def find_hot_regions(heatmap: list[HeatMarker], max_regions: int = 6) -> list[Region]:
    """Detect most-replayed spans and let each clip's length follow the wave."""
    if not heatmap:
        return []
    n = len(heatmap)
    values = [m.value for m in heatmap]
    vmax = max(values)
    vmean = sum(values) / n
    if vmax <= 0:
        return []

    core_thr = max(vmean * 1.15, vmax * CORE_RATIO)
    ext_thr = max(vmean * 0.9, vmax * EXTEND_RATIO)

    regions: list[Region] = []
    i = 0
    while i < n:
        if values[i] < core_thr:
            i += 1
            continue
        # strong core run [i..j]
        j = i
        while j + 1 < n and values[j + 1] >= core_thr:
            j += 1
        # grow outward along the wave while still above the shoulder threshold
        a = i
        while a - 1 >= 0 and values[a - 1] >= ext_thr:
            a -= 1
        b = j
        while b + 1 < n and values[b + 1] >= ext_thr:
            b += 1

        core = heatmap[i : j + 1]
        wsum = sum(m.value for m in core) or 1e-9
        centroid = sum(m.value * ((m.start + m.end) / 2) for m in core) / wsum
        area = sum(m.value * (m.end - m.start) for m in core)
        regions.append(
            Region(
                start=heatmap[a].start,
                end=heatmap[b].end,
                core_start=heatmap[i].start,
                core_end=heatmap[j].end,
                centroid=centroid,
                area=area,
                peak=max(m.value for m in core),
            )
        )
        i = j + 1

    regions.sort(key=lambda r: r.area, reverse=True)
    return regions[:max_regions]


def _caption_at(captions: list[Caption], t: float) -> Optional[Caption]:
    for c in captions:
        if c.start <= t <= c.end:
            return c
    return None


def _snap_start_to_caption(captions: list[Caption], t: float, back: float = 3.0) -> float:
    best = t
    for c in captions:
        if t - back <= c.start <= t + 0.5:
            best = c.start
            break
    return max(0.0, best)


def _snap_end_to_caption(captions: list[Caption], t: float, fwd: float = 3.0) -> float:
    """Extend the end to finish a sentence rather than cutting mid-word."""
    best = t
    for c in captions:
        if t - 0.5 <= c.end <= t + fwd:
            best = c.end
    return best


def _norm(text: str) -> str:
    return " ".join(text.split())


def _hook_text(captions: list[Caption], start: float, end: float) -> str:
    span = [c.text for c in captions if start <= c.start < end]
    if not span:
        c = _caption_at(captions, start)
        return _norm(c.text) if c else ""
    return _norm(" ".join(span[:2]))[:120]


def _fmt(sec: float) -> str:
    m, s = divmod(int(sec), 60)
    return f"{m}:{s:02d}"


def _region_to_bounds(region: Region, duration: float) -> tuple[float, float]:
    """Clip bounds = the wave-following span, only clamped by MIN/MAX for sanity."""
    start, end = region.start, region.end
    length = end - start
    if length < MIN_CLIP:
        pad = (MIN_CLIP - length) / 2
        start -= pad
        end += pad
    elif length > MAX_CLIP:
        start = region.centroid - MAX_CLIP / 2
        end = start + MAX_CLIP
        # never drop the strong core
        if region.core_start < start:
            start = region.core_start
        if region.core_end > end:
            end = region.core_end
        if end - start > MAX_CLIP:
            end = start + MAX_CLIP
    start = max(0.0, start - LEAD_IN)
    if duration:
        end = min(duration, end)
    if end - start < MIN_CLIP:
        start = max(0.0, end - MIN_CLIP)
    return start, end


def heuristic_candidates(analysis: VideoAnalysis, regions: list[Region]) -> list[Candidate]:
    out: list[Candidate] = []
    dur = analysis.duration or (regions[0].end if regions else 0)
    for r in regions:
        start, end = _region_to_bounds(r, dur)
        start = _snap_start_to_caption(analysis.captions, start)
        end = _snap_end_to_caption(analysis.captions, end)
        if end - start < MIN_CLIP:
            end = min(dur or end, start + MIN_CLIP)
        out.append(
            Candidate(
                start=start,
                end=end,
                hot_start=r.core_start,
                hot_end=r.core_end,
                hook_text=_hook_text(analysis.captions, start, end),
                score=r.peak,
                source="heatmap",
                reason=(
                    f"Most replayed {_fmt(r.core_start)}–{_fmt(r.core_end)} · "
                    f"~{int(end - start)}s clip from the heat curve"
                ),
            )
        )
    return out


def _transcript_window(captions: list[Caption], start: float, end: float, pad: float = 10.0) -> str:
    lines = [
        f"[{c.start:.0f}s] {c.text}"
        for c in captions
        if start - pad <= c.start <= end + pad
    ]
    return "\n".join(lines)


def generate_candidates(analysis: VideoAnalysis, max_regions: int = 6) -> list[Candidate]:
    regions = find_hot_regions(analysis.heatmap, max_regions=max_regions)

    if not regions and analysis.captions:
        return _no_heatmap_candidates(analysis, max_regions)
    if not regions:
        return []

    base = heuristic_candidates(analysis, regions)
    if not analysis.captions or not os.environ.get("ANTHROPIC_API_KEY"):
        return base
    try:
        return _llm_refine(analysis, base)
    except Exception:  # noqa: BLE001 - never fail the request over the LLM
        return base


def _no_heatmap_candidates(analysis: VideoAnalysis, max_regions: int) -> list[Candidate]:
    """No heatmap → sample the transcript; length still varies (ends on sentences)."""
    dur = analysis.duration
    step = max(MAX_CLIP, dur / (max_regions + 1))
    out: list[Candidate] = []
    t = step / 2
    while t < dur and len(out) < max_regions:
        start = _snap_start_to_caption(analysis.captions, t)
        end = _snap_end_to_caption(analysis.captions, min(dur, start + 22.0), fwd=8.0)
        if end - start < MIN_CLIP:
            end = min(dur, start + MIN_CLIP)
        out.append(
            Candidate(start, end, start, end, _hook_text(analysis.captions, start, end),
                      0.0, source="transcript", reason="No heatmap — transcript moment")
        )
        t += step
    return out


def _llm_refine(analysis: VideoAnalysis, base: list[Candidate]) -> list[Candidate]:
    import anthropic

    client = anthropic.Anthropic()
    regions = []
    for i, c in enumerate(base):
        regions.append(
            {
                "id": i,
                "heatmapScore": round(c.score, 3),
                "mostReplayedStart": round(c.hot_start, 1),
                "mostReplayedEnd": round(c.hot_end, 1),
                "heatCurveSuggestedLength": round(c.end - c.start, 1),
                "transcript": _transcript_window(analysis.captions, c.start, c.end),
            }
        )

    system = (
        "You are a short-form video editor. Each region gives the EXACT most-replayed "
        "span of a YouTube video, the length the heat curve suggests, and the "
        "transcript. Choose start/end seconds for a vertical Short that (a) OPENS on a "
        "strong hook line, (b) fully CONTAINS the most-replayed span, (c) has a length "
        "that fits the moment — DO NOT default to a fixed duration; match the natural "
        "length of the story beat, guided by heatCurveSuggestedLength, between "
        f"{int(MIN_CLIP)} and {int(MAX_CLIP)}s. Return STRICT JSON only."
    )
    user = (
        "Regions:\n"
        + json.dumps(regions, ensure_ascii=False)
        + '\n\nReturn JSON: {"clips":[{"id":int,"start":number,"end":number,'
        '"hookText":string,"reason":string}]}. hookText = the spoken line the clip '
        "opens on. Keep the same ids. JSON only, no prose."
    )

    msg = client.messages.create(
        model=MODEL,
        max_tokens=1500,
        system=system,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user, "cache_control": {"type": "ephemeral"}}
                ],
            }
        ],
    )
    text = msg.content[0].text.strip()
    text = text[text.find("{") : text.rfind("}") + 1]
    data = json.loads(text)

    refined: list[Candidate] = []
    dur = analysis.duration
    for clip in data.get("clips", []):
        i = clip.get("id", 0)
        b = base[i] if 0 <= i < len(base) else base[0]
        start = max(0.0, float(clip["start"]))
        end = min(dur, float(clip["end"]))
        start = min(start, b.hot_start)
        end = max(end, b.hot_end)
        if end - start > MAX_CLIP:
            end = start + MAX_CLIP
        if end - start < MIN_CLIP:
            end = min(dur, start + MIN_CLIP)
        refined.append(
            Candidate(
                start=start,
                end=end,
                hot_start=b.hot_start,
                hot_end=b.hot_end,
                hook_text=clip.get("hookText", "")[:160],
                score=b.score,
                source="ai",
                reason=clip.get("reason", "")[:160],
            )
        )
    refined.sort(key=lambda c: c.score, reverse=True)
    return refined or base
