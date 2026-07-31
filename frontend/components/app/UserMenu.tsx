"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { clearToken, me, type User } from "@/lib/api";

export function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    me().then((u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  if (!ready) return <div className="h-9 w-9" />;

  if (!user) {
    return (
      <Link
        href="/signin"
        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
      >
        Sign in
      </Link>
    );
  }

  const initial = (user.name || user.email).charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <span
        title={user.email}
        className="grid h-8 w-8 place-items-center rounded-full bg-heat text-xs font-bold text-white"
      >
        {initial}
      </span>
      <button
        onClick={() => {
          clearToken();
          setUser(null);
        }}
        title="Sign out"
        className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
