"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sfx } from "@/lib/audio";

export function HeroPaste() {
  const [url, setUrl] = useState("");
  const router = useRouter();

  function go() {
    sfx.whoosh();
    const u = url.trim();
    router.push(u ? `/app?url=${encodeURIComponent(u)}` : "/app");
  }

  return (
    <div className="mx-auto mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
      <div className="flex h-14 flex-1 items-center rounded-2xl border border-border bg-card px-4 shadow-soft focus-within:ring-2 focus-within:ring-ring">
        <span className="mr-2 text-muted-foreground">▶</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="Paste a YouTube link…"
          className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <Button size="lg" className="h-14" onClick={go}>
        Get my Shorts
        <ArrowRight />
      </Button>
    </div>
  );
}
