import Link from "next/link";
import { Flame } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="container flex flex-col gap-8 py-14 md:flex-row md:justify-between">
        <div className="max-w-xs">
          <div className="flex items-center gap-2 font-bold text-lg">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-heat text-white">
              <Flame className="h-4 w-4 animate-flame" />
            </span>
            HeatClip
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Turn your most-replayed YouTube moments into ready-to-post vertical Shorts.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
          {[
            {
              h: "Product",
              items: [
                { label: "Features", href: "/#features" },
                { label: "Pricing", href: "/#pricing" },
                { label: "Studio", href: "/app" },
              ],
            },
            {
              h: "Company",
              items: [
                { label: "About", href: "#" },
                { label: "Blog", href: "#" },
                { label: "Contact", href: "/support" },
              ],
            },
            {
              h: "Support",
              items: [
                { label: "Help & support", href: "/support" },
                { label: "Send feedback", href: "/support" },
                { label: "Sign in", href: "/signin" },
              ],
            },
          ].map((col) => (
            <div key={col.h}>
              <div className="mb-3 font-semibold">{col.h}</div>
              <ul className="space-y-2 text-muted-foreground">
                {col.items.map((i) => (
                  <li key={i.label}>
                    <Link href={i.href} className="hover:text-foreground">
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container flex h-14 items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} HeatClip. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
