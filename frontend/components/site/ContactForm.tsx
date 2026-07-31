"use client";

import { useState } from "react";
import { CheckCircle2, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendContact } from "@/lib/api";

const TOPICS = ["General support", "Feedback / idea", "Report a bug", "Billing"];

export function ContactForm() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await sendContact({
        name: String(fd.get("name") || ""),
        email: String(fd.get("email") || ""),
        topic,
        message: String(fd.get("message") || ""),
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Could not send. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-bold">Message sent</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Thanks for reaching out — our team typically replies within one business
          day. Keep an eye on your inbox.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => setSent(false)}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-border bg-card p-6 shadow-soft"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Name</label>
          <Input name="name" placeholder="Your name" required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Email</label>
          <Input name="email" type="email" placeholder="you@email.com" required />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-medium">Topic</label>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(t)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                topic === t
                  ? "bg-heat text-white shadow-glow"
                  : "border border-border bg-muted/50 text-foreground hover:bg-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-medium">Message</label>
        <textarea
          name="message"
          required
          rows={5}
          placeholder="Tell us what's going on, or share your idea…"
          className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <Button type="submit" className="mt-5 w-full sm:w-auto" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <Send />}
        {loading ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
