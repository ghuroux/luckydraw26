import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { CreateEventForm } from "./CreateEventForm";

export default async function NewEventPage() {
  await requireRole("ADMIN");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/events"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Events
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          New event
        </h1>
        <p className="mt-2 text-muted-foreground">
          Set the basics now. Prizes and entry packages can be added once the
          event is created.
        </p>
      </div>

      <CreateEventForm />
    </div>
  );
}
