"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sfx } from "@/lib/audio";

const SECTIONS = [
  { id: "features", label: "Features" },
  { id: "how", label: "How it works" },
  { id: "pricing", label: "Pricing" },
];

export function NavLinks() {
  const pathname = usePathname();
  const onLanding = pathname === "/";
  const [active, setActive] = useState<string>("");

  // Scroll-spy: highlight whichever section sits near the top-centre of the viewport.
  useEffect(() => {
    if (!onLanding) return;
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => !!el
    );
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (vis[0]) setActive((vis[0].target as HTMLElement).id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [onLanding]);

  const linkCls = (isActive: boolean) =>
    `relative py-1 transition-colors ${
      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  const underline = (
    <span className="absolute -bottom-0.5 left-0 h-0.5 w-full rounded-full bg-heat" />
  );

  return (
    <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
      {SECTIONS.map((s) => {
        const isActive = onLanding && active === s.id;
        return (
          <a
            key={s.id}
            href={`/#${s.id}`}
            onClick={() => {
              setActive(s.id);
              sfx.hover();
            }}
            className={linkCls(isActive)}
          >
            {s.label}
            {isActive && underline}
          </a>
        );
      })}
      <Link
        href="/support"
        onClick={() => sfx.hover()}
        className={linkCls(pathname.startsWith("/support"))}
      >
        Support
        {pathname.startsWith("/support") && underline}
      </Link>
    </nav>
  );
}
