import Link from "next/link";
import {
  Activity,
  Sparkles,
  MoveHorizontal,
  Smartphone,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { HeroPaste } from "@/components/site/HeroPaste";
import { Hero3D } from "@/components/site/Hero3D";
import { Pricing } from "@/components/site/Pricing";
import { HoverSound } from "@/components/site/HoverSound";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Activity,
    title: "Real most-replayed data",
    body: "We read YouTube's own heatmap — the exact spans your viewers rewatched — instead of guessing what's good.",
  },
  {
    icon: Sparkles,
    title: "AI-picked hooks",
    body: "Each clip opens on a punchy line pulled straight from your transcript, so it grabs attention in the first second.",
  },
  {
    icon: MoveHorizontal,
    title: "Drag to fine-tune",
    body: "See the heatmap on a timeline and drag the handles to trim any clip to the exact frame you want.",
  },
  {
    icon: Smartphone,
    title: "Ready-to-post 9:16",
    body: "Every clip is rendered as a clean 1080×1920 vertical Short — download and upload anywhere.",
  },
];

const STEPS = [
  { n: "01", t: "Paste your link", d: "Drop any YouTube URL. We pull the heatmap, metadata, and transcript in seconds." },
  { n: "02", t: "Pick the hot moments", d: "We surface the most-replayed spans as hook-led clips. Tweak the timing on the heatmap." },
  { n: "03", t: "Export your Shorts", d: "Render polished vertical clips and download them, ready to post." },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid" />
        <div className="container relative grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
          <div className="animate-fade-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-heat text-white">
                <Zap className="h-2.5 w-2.5" />
              </span>
              Powered by YouTube's most-replayed heatmap
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Turn your best moments into{" "}
              <span className="heat-text">Shorts.</span> Automatically.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              HeatClip finds the exact parts of your video people rewatch the most —
              then turns them into ready-to-post vertical clips. No scrubbing. No
              guessing.
            </p>
            <HeroPaste />
            <p className="mt-3 text-xs text-muted-foreground">
              Free to try · No credit card · Works with any public YouTube video
            </p>
          </div>
          <div className="animate-fade-up [animation-delay:120ms]">
            <Hero3D />
          </div>
        </div>
      </section>

      {/* Logos / trust strip */}
      <section className="border-y border-border bg-muted/40 py-6">
        <div className="container flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-medium text-muted-foreground">
          <span>Trusted by creators making</span>
          <span className="heat-text font-bold">10,000+ Shorts</span>
          <span>from long-form video every month</span>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-20 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to clip smarter
          </h2>
          <p className="mt-4 text-muted-foreground">
            Stop watching your videos back at 2x to find the good parts. Let the data
            do it.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <HoverSound
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-heat/10 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-heat group-hover:text-white">
                <f.icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </HoverSound>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-border bg-muted/30 py-20 lg:py-28">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              From link to Shorts in three steps
            </h2>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <div className="heat-text text-5xl font-extrabold">{s.n}</div>
                <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <Pricing />

      {/* CTA */}
      <section className="container pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-heat px-8 py-16 text-center text-white shadow-glow">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Your next viral Short is already in your video.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">
            Paste a link and let HeatClip find it for you.
          </p>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="mt-8 border-white bg-white text-zinc-900 hover:bg-white/90"
          >
            <Link href="/app">Try HeatClip free</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
