import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Lucky Draw</h1>
      <p className="text-muted">Phase 0 — scaffolding in progress.</p>
      <Link
        href="/login"
        className="rounded-md bg-primary px-4 py-2 text-white transition hover:opacity-90"
      >
        Admin login
      </Link>
    </main>
  );
}
