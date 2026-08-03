import type { Metadata } from "next";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";

export const metadata: Metadata = { title: "Terms of Service — HeatClip" };

export default function Terms() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="container max-w-2xl flex-1 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 2026</p>

        <div className="prose-sm mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold">1. What HeatClip does</h2>
            <p className="mt-2 text-muted-foreground">
              HeatClip analyzes a YouTube video's public "most replayed" data and
              transcript to help you create short vertical clips. You provide a video
              link; we generate downloadable clips.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">2. Your responsibility & content rights</h2>
            <p className="mt-2 text-muted-foreground">
              You are responsible for the videos you process. Only create clips from
              content you own or have the rights to use. Do not use HeatClip to
              infringe copyright or violate YouTube's Terms of Service. You retain
              rights to clips you generate from your own content.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">3. Acceptable use</h2>
            <p className="mt-2 text-muted-foreground">
              Don't abuse the service (excessive automated requests, attempts to
              disrupt it, or processing unlawful content). We may rate-limit or
              suspend accounts that do.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">4. Plans & availability</h2>
            <p className="mt-2 text-muted-foreground">
              Features may vary by plan. The service is provided "as is" without
              warranty; we don't guarantee uninterrupted availability or that every
              video can be processed (e.g. private or restricted videos).
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">5. Contact</h2>
            <p className="mt-2 text-muted-foreground">
              Questions? Reach us via the{" "}
              <a href="/support" className="text-primary hover:underline">support page</a>.
            </p>
          </section>
          <p className="text-xs text-muted-foreground">
            This is a general template, not legal advice — have it reviewed before a
            public launch.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
