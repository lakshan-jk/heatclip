import Link from "next/link";
import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SoundToggle } from "@/components/site/SoundToggle";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { NavLinks } from "@/components/site/NavLinks";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-heat text-white shadow-glow">
            <Flame className="h-4 w-4 animate-flame" />
          </span>
          HeatClip
        </Link>
        <NavLinks />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SoundToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/signin">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/app">Try free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
