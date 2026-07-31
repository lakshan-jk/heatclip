import Link from "next/link";
import { Flame } from "lucide-react";
import { SoundToggle } from "@/components/site/SoundToggle";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { UserMenu } from "@/components/app/UserMenu";

export function AppBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-heat text-white shadow-glow">
            <Flame className="h-3.5 w-3.5 animate-flame" />
          </span>
          HeatClip
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SoundToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
