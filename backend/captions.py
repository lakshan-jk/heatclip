"""Styled ASS captions with word-level karaoke highlighting and multiple themes.

Input is word-level timing: [(start, end, word)] relative to the clip. Words are
grouped into short lines; themes with `karaoke` highlight each word as it's spoken
(the retention-boosting "hormozi/karaoke" style). Falls back to line-pop for
themes without karaoke, and works from approximate timing when only lines exist.
"""
from __future__ import annotations

from pathlib import Path

MAX_WORDS_PER_LINE = 4
MAX_LINE_GAP = 0.8  # start a new line if there's a pause longer than this

# ASS colours are &HAABBGGRR (BGR). base = unsung, highlight = spoken/active.
THEMES: dict[str, dict] = {
    "classic": {
        "font": "Arial", "size_div": 20, "bold": -1,
        "base": "&H00FFFFFF", "highlight": "&H00FFFFFF",
        "outline": 4, "shadow": 2, "karaoke": False,
    },
    "karaoke": {
        "font": "Arial", "size_div": 19, "bold": -1,
        "base": "&H00FFFFFF", "highlight": "&H0000E5FF",  # amber
        "outline": 4, "shadow": 2, "karaoke": True,
    },
    "hormozi": {
        "font": "Arial", "size_div": 16, "bold": -1,
        "base": "&H00FFFFFF", "highlight": "&H0000FF3B",  # green
        "outline": 6, "shadow": 3, "karaoke": True,
    },
    "neon": {
        "font": "Arial", "size_div": 18, "bold": -1,
        "base": "&H00FFFFFF", "highlight": "&H00FF00E5",  # magenta
        "outline": 5, "shadow": 3, "karaoke": True,
    },
    "minimal": {
        "font": "Helvetica", "size_div": 24, "bold": 0,
        "base": "&H00FFFFFF", "highlight": "&H00FFFFFF",
        "outline": 2, "shadow": 0, "karaoke": False,
    },
}
DEFAULT_THEME = "karaoke"


def words_from_lines(
    lines: list[tuple[float, float, str]]
) -> list[tuple[float, float, str]]:
    """Split line-level captions into approximate per-word timing (even spacing)
    so karaoke still animates when only line timing is available (e.g. YT VTT)."""
    words: list[tuple[float, float, str]] = []
    for start, end, text in lines:
        toks = text.split()
        if not toks:
            continue
        dur = max(0.2, end - start)
        per = dur / len(toks)
        for i, tok in enumerate(toks):
            ws = start + i * per
            words.append((ws, ws + per, tok))
    return words


def _ts(t: float) -> str:
    t = max(0.0, t)
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _group_lines(words: list[tuple[float, float, str]]) -> list[list[tuple[float, float, str]]]:
    lines: list[list] = []
    cur: list = []
    for w in words:
        if not w[2].strip():
            continue
        if cur and (len(cur) >= MAX_WORDS_PER_LINE or w[0] - cur[-1][1] > MAX_LINE_GAP):
            lines.append(cur)
            cur = []
        cur.append(w)
    if cur:
        lines.append(cur)
    return lines


def build_ass(
    words: list[tuple[float, float, str]],
    width: int,
    height: int,
    out_path: Path,
    theme: str = DEFAULT_THEME,
) -> Path:
    th = THEMES.get(theme, THEMES[DEFAULT_THEME])
    fontsize = max(28, int(height / th["size_div"]))
    margin_v = int(height * 0.20)
    # In ASS karaoke, text starts in SecondaryColour and \k fills to PrimaryColour.
    primary = th["highlight"] if th["karaoke"] else th["base"]
    secondary = th["base"]
    style = (
        f"Style: Cap,{th['font']},{fontsize},{primary},{secondary},"
        f"&H00000000,&H90000000,{th['bold']},0,0,0,100,100,0,0,1,"
        f"{th['outline']},{th['shadow']},2,80,80,{margin_v},1"
    )
    header = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {width}\nPlayResY: {height}\nWrapStyle: 2\n\n"
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
    for line in _group_lines(words):
        start = line[0][0]
        end = line[-1][1]
        if th["karaoke"]:
            parts = []
            for ws, we, text in line:
                cs = max(1, int(round((we - ws) * 100)))  # centiseconds
                parts.append(f"{{\\k{cs}}}{text.upper()} ")
            body = "".join(parts).rstrip()
        else:
            body = "{\\fad(60,40)}" + " ".join(w[2].upper() for w in line)
        lines.append(f"Dialogue: 0,{_ts(start)},{_ts(end)},Cap,,0,0,0,,{body}")
    out_path.write_text("\n".join(lines))
    return out_path
