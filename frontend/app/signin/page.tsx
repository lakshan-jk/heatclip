"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, Mail, Lock, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { login, signup } from "@/lib/api";

export default function SignIn() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");
    const name = String(fd.get("name") || "");
    setLoading(true);
    try {
      if (mode === "signup") await signup(email, password, name);
      else await login(email, password);
      router.push("/app");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="pointer-events-none absolute inset-0 bg-grid" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-heat text-white shadow-glow">
            <Flame className="h-4 w-4 animate-flame" />
          </span>
          HeatClip
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to turn videos into Shorts."
                : "Start clipping in seconds — no credit card."}
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
            {/* social */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Google", c: "#ea4335" },
                { label: "GitHub", c: "#111" },
                { label: "YouTube", c: "#ff0000" },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => router.push("/app")}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 py-2.5 text-xs font-medium transition-colors hover:bg-muted"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: s.c }}
                  />
                  {s.label}
                </button>
              ))}
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or {mode === "signin" ? "sign in" : "sign up"} with email
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              {mode === "signup" && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input name="name" placeholder="Full name" className="pl-9" required />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input name="email" type="email" placeholder="you@email.com" className="pl-9" required />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input name="password" type="password" placeholder="Password (min 6 chars)" className="pl-9" required />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              {mode === "signin" && (
                <div className="text-right">
                  <Link href="/support" className="text-xs text-muted-foreground hover:text-foreground">
                    Forgot password?
                  </Link>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New to HeatClip?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            By continuing you agree to our Terms & Privacy Policy.
          </p>
        </div>
      </main>
    </div>
  );
}
