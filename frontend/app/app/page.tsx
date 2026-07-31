import { Suspense } from "react";
import { AppClient } from "@/components/app/AppClient";

export default function AppPage() {
  return (
    <Suspense fallback={<div className="container py-20 text-muted-foreground">Loading…</div>}>
      <AppClient />
    </Suspense>
  );
}
