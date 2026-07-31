// Decorative heatmap graph used in the hero — evokes the product's core idea.
const BARS = [
  18, 24, 30, 46, 72, 58, 40, 33, 28, 24, 22, 26, 34, 30, 26, 38, 55, 84, 96, 78,
  52, 36, 30, 34, 44, 40, 32, 28, 30, 42, 66, 90, 70, 48, 36, 30, 26, 24, 28, 40,
];

export function HeatmapArt() {
  const w = 100;
  const h = 46;
  const pts = BARS.map((v, i) => {
    const x = (i / (BARS.length - 1)) * w;
    const y = h - (v / 100) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const area = `M0,${h} L${pts.join(" L")} L${w},${h} Z`;
  // highlight the two hottest spans
  const hot = [
    { from: 17, to: 20 },
    { from: 30, to: 32 },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">
          MOST REPLAYED
        </span>
        <span className="rounded-full bg-heat px-2 py-0.5 text-[10px] font-bold text-white">
          2 hot moments
        </span>
      </div>
      <div className="relative h-28">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="heroheat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(351 83% 59%)" stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(24 95% 55%)" stopOpacity="0.08" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#heroheat)" stroke="hsl(351 83% 59%)" strokeWidth="0.7" />
        </svg>
        {hot.map((seg, i) => (
          <div
            key={i}
            className="absolute bottom-0 h-1.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,.8)]"
            style={{
              left: `${(seg.from / (BARS.length - 1)) * 100}%`,
              width: `${((seg.to - seg.from) / (BARS.length - 1)) * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {["0:14 – 0:38", "1:02 – 1:29", "+ 3 more"].map((t, i) => (
          <div
            key={t}
            className={`rounded-xl border p-3 ${
              i < 2 ? "border-primary/30 bg-primary/5" : "border-border bg-muted/50"
            }`}
          >
            <div className="aspect-[9/16] w-full rounded-lg bg-gradient-to-b from-zinc-800 to-zinc-900" />
            <div className="mt-2 text-[10px] font-medium text-muted-foreground">{t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
