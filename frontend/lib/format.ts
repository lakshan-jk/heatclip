export function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// "1:23" or "83" or "1:23.5" -> seconds
export function parseTime(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  if (t.includes(":")) {
    const parts = t.split(":").map((p) => parseFloat(p));
    if (parts.some((p) => isNaN(p))) return null;
    const [m, s] = parts.length === 2 ? parts : [0, parts[0]];
    return m * 60 + s;
  }
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}
