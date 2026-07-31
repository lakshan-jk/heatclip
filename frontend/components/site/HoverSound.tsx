"use client";

import { sfx } from "@/lib/audio";

// Wrapper that plays the hover blip on mouse-enter (no-op unless sound is on).
// Lets Server Components add sound without becoming client components themselves.
export function HoverSound({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className} onMouseEnter={() => sfx.hover()}>
      {children}
    </div>
  );
}
