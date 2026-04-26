import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-semibold tracking-tight">Lucky Draw</h1>
        <p className="mt-3 text-muted-foreground">
          Phase 0 — scaffolding in progress.
        </p>
      </div>
      <Button render={<Link href="/login" />}>Admin login</Button>
    </main>
  );
}
