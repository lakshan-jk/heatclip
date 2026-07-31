"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Plan = {
  name: string;
  tag: string;
  monthly: number;
  yearly: number; // per-month price when billed yearly
  cta: string;
  popular?: boolean;
  feats: string[];
};

const PLANS: Plan[] = [
  {
    name: "Free",
    tag: "For trying it out",
    monthly: 0,
    yearly: 0,
    cta: "Start free",
    feats: ["3 videos / month", "Up to 6 clips per video", "720p export", "Replay-heatmap detection"],
  },
  {
    name: "Creator",
    tag: "For serious creators",
    monthly: 19,
    yearly: 15,
    cta: "Go Creator",
    popular: true,
    feats: [
      "Unlimited videos",
      "Unlimited clips",
      "1080p export",
      "AI hook detection",
      "Custom clip lengths",
      "Priority rendering",
    ],
  },
  {
    name: "Studio",
    tag: "For teams & agencies",
    monthly: 49,
    yearly: 39,
    cta: "Start Studio",
    feats: [
      "Everything in Creator",
      "3 team seats",
      "Auto-captions",
      "Brand watermark",
      "API access",
      "Priority support",
    ],
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(true);

  return (
    <section id="pricing" className="container py-20 lg:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Simple, creator-friendly pricing
        </h2>
        <p className="mt-4 text-muted-foreground">
          Start free. Upgrade when you're posting every day.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          Payments coming soon — HeatClip is free to use right now
        </div>

        {/* billing toggle */}
        <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 p-1 text-sm">
          <button
            onClick={() => setYearly(false)}
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
              !yearly ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition-colors ${
              yearly ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Yearly
            <span className="rounded-full bg-heat px-1.5 py-0.5 text-[10px] font-bold text-white">
              −20%
            </span>
          </button>
        </div>
      </div>

      <div className="mx-auto mt-14 grid max-w-5xl items-start gap-6 md:grid-cols-3">
        {PLANS.map((p) => {
          const price = yearly ? p.yearly : p.monthly;
          const card = (
            <div className="flex h-full flex-col rounded-[calc(1.5rem-2px)] bg-card p-7">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{p.name}</h3>
                {p.popular && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-heat px-2.5 py-1 text-[11px] font-bold text-white shadow-glow">
                    <Sparkles className="h-3 w-3" /> Most popular
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.tag}</p>

              <div className="mt-5 flex items-end gap-1">
                <span className="text-5xl font-extrabold tracking-tight">${price}</span>
                <span className="mb-1.5 text-sm text-muted-foreground">/mo</span>
              </div>
              <p className="mt-1 h-4 text-xs text-muted-foreground">
                {price > 0 && yearly ? `billed yearly` : price > 0 ? "billed monthly" : "free forever"}
              </p>

              {p.monthly === 0 ? (
                <Button asChild variant="outline" className="mt-6 w-full">
                  <Link href="/app">{p.cta}</Link>
                </Button>
              ) : (
                <Button
                  variant={p.popular ? "default" : "outline"}
                  className="mt-6 w-full"
                  disabled
                >
                  Coming soon
                </Button>
              )}

              <ul className="mt-7 space-y-3 text-sm">
                {p.feats.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                        p.popular ? "bg-heat text-white" : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );

          // Popular plan gets a heat gradient border + lift; others a plain border.
          return p.popular ? (
            <div
              key={p.name}
              className="rounded-3xl bg-heat p-0.5 shadow-glow md:-translate-y-3"
            >
              {card}
            </div>
          ) : (
            <div
              key={p.name}
              className="rounded-3xl border border-border shadow-soft"
            >
              {card}
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        No credit card required for Free · Cancel anytime · Prices in USD
      </p>
    </section>
  );
}
