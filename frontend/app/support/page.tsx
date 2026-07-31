import Link from "next/link";
import {
  BookOpen,
  Mail,
  MessagesSquare,
  LifeBuoy,
  ArrowRight,
} from "lucide-react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { ContactForm } from "@/components/site/ContactForm";
import { HoverSound } from "@/components/site/HoverSound";

const CHANNELS = [
  {
    icon: BookOpen,
    title: "Help center",
    body: "Guides on links, heatmaps, clip lengths and export quality.",
    action: "Browse docs",
  },
  {
    icon: MessagesSquare,
    title: "Community",
    body: "Ask other creators and share what's working in our Discord.",
    action: "Join Discord",
  },
  {
    icon: Mail,
    title: "Email us",
    body: "Prefer email? Reach the team directly any time.",
    action: "support@heatclip.app",
  },
];

const FAQ = [
  {
    q: "Why does one video have no heatmap?",
    a: "YouTube only computes a “most replayed” graph for videos with enough views. For newer or smaller videos we suggest moments from the transcript instead.",
  },
  {
    q: "What export qualities are supported?",
    a: "720p, 1080p, 2K and 4K vertical (9:16). Higher tiers pull higher-resolution source and encode at a higher bitrate.",
  },
  {
    q: "Can I set my own clip length?",
    a: "Yes — pick our Recommended length (from the heat curve) or force 30/45/60/90/120s, and fine-tune each clip by dragging on the heatmap.",
  },
  {
    q: "Can I clip other people's videos?",
    a: "HeatClip is intended for creators clipping their own content. Please respect copyright and YouTube's terms.",
  },
];

export default function Support() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-grid" />
        <div className="container relative py-16 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-heat text-white shadow-glow">
            <LifeBuoy className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            How can we help?
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Get support, report a bug, or send us feedback — we read everything and
            reply fast.
          </p>
        </div>
      </section>

      {/* channels */}
      <section className="container py-14">
        <div className="grid gap-5 md:grid-cols-3">
          {CHANNELS.map((c) => (
            <HoverSound
              key={c.title}
              className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-heat/10 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 group-hover:bg-heat group-hover:text-white">
                <c.icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
              </div>
              <h3 className="font-semibold">{c.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{c.body}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                {c.action}{" "}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </HoverSound>
          ))}
        </div>
      </section>

      {/* form + faq */}
      <section className="container grid gap-10 pb-20 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reach out</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Fill this in and we'll get back to you within one business day.
          </p>
          <div className="mt-6">
            <ContactForm />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight">Common questions</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Quick answers to the things people ask most.
          </p>
          <div className="mt-6 space-y-3">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-border bg-card p-5 shadow-soft"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                  {f.q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-5 text-sm">
            Still stuck?{" "}
            <Link href="/app" className="font-semibold text-primary hover:underline">
              Try the studio
            </Link>{" "}
            or email{" "}
            <span className="font-semibold">support@heatclip.app</span>.
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
