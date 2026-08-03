import type { Metadata } from "next";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";

export const metadata: Metadata = { title: "Privacy Policy — HeatClip" };

export default function Privacy() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="container max-w-2xl flex-1 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold">What we collect</h2>
            <p className="mt-2 text-muted-foreground">
              If you create an account, we store your email and a securely hashed
              password. When you process a video, we temporarily fetch its public
              metadata, transcript, and media to generate clips.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">How we use it</h2>
            <p className="mt-2 text-muted-foreground">
              Only to provide the service: authenticating you and rendering your
              clips. Rendered clips and temporary source files are stored briefly and
              auto-deleted (within hours). We don't sell your data.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Cookies & analytics</h2>
            <p className="mt-2 text-muted-foreground">
              We use a token in your browser to keep you signed in. If analytics are
              enabled, we use a privacy-friendly, cookieless analytics tool to count
              visits — no personal profiles.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Your choices</h2>
            <p className="mt-2 text-muted-foreground">
              You can sign out any time (which clears your token) and request deletion
              of your account data via the{" "}
              <a href="/support" className="text-primary hover:underline">support page</a>.
            </p>
          </section>
          <p className="text-xs text-muted-foreground">
            This is a general template, not legal advice.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
