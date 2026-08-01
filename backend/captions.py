"""Build a styled ASS subtitle file from transcript lines — big, bold, centered
captions in short punchy chunks (the retention-boosting Shorts style)."""
from __future__ import annotations

from pathlib import Path

WORDS_PER_CHUNK = 3


def _ts(t: float) -> str:
    t = max(0.0, t)
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _norm(text: str) -> str:
    return " ".join(text.split())


def _chunks(words: list[str], n: int) -> list[list[str]]:
    return [words[i : i + n] for i in range(0, len(words), n)]


def build_ass(caps: list[tuple[float, float, str]], width: int, height: int, out_path: Path) -> Path:
    """caps: (start, end, text) with times RELATIVE to the clip (>= 0)."""
    events: list[tuple[float, float, str]] = []
    for start, end, text in caps:
        text = _norm(text)
        if not text:
            continue
        chunks = _chunks(text.split(), WORDS_PER_CHUNK)
        if not chunks:
            continue
        dur = max(0.25, end - start)
        per = dur / len(chunks)
        for i, ch in enumerate(chunks):
            cs = start + i * per
            events.append((cs, cs + per, " ".join(ch).upper()))

    fontsize = max(28, int(height / 20))
    outline = max(3, fontsize // 12)
    shadow = max(1, fontsize // 24)
    margin_v = int(height * 0.18)  # sit in the lower third
    # PrimaryColour white, OutlineColour black, thick outline for readability.
    style = (
        f"Style: Pop,Arial,{fontsize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,"
        f"-1,0,0,0,100,100,0,0,1,{outline},{shadow},2,80,80,{margin_v},1"
    )
    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {width}\n"
        f"PlayResY: {height}\n"
        "WrapStyle: 2\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, "
        "ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
        "MarginR, MarginV, Encoding\n"
        f"{style}\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, "
        "Effect, Text\n"
    )
    lines = [header]
    for cs, ce, txt in events:
        # subtle pop: quick fade in/out
        lines.append(
            f"Dialogue: 0,{_ts(cs)},{_ts(ce)},Pop,,0,0,0,,{{\\fad(60,40)}}{txt}"
        )
    out_path.write_text("\n".join(lines))
    return out_path
