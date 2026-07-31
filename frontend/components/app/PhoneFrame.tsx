import { cn } from "@/lib/utils";

export function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[9/16] w-full overflow-hidden rounded-[1.6rem] border-[3px] border-zinc-900 bg-black shadow-soft ring-1 ring-black/5",
        className
      )}
    >
      {/* notch */}
      <div className="absolute left-1/2 top-2 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-white/25" />
      {children}
    </div>
  );
}
