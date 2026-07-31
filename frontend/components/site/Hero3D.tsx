"use client";

import dynamic from "next/dynamic";

// WebGL + Web Audio are client-only; skip SSR entirely.
const Scene = dynamic(() => import("./Hero3DScene"), {
  ssr: false,
  loading: () => (
    <div className="aspect-[4/3] w-full animate-pulse rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900 to-black shadow-glow" />
  ),
});

export function Hero3D() {
  return <Scene />;
}
