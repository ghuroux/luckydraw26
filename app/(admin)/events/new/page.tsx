import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/shell";
import { CreateEventForm } from "./CreateEventForm";

export default async function NewEventPage() {
  await requireRole("ADMIN");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-5">
        <Link
          href="/events"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Events
        </Link>
        <PageHeader
          title="New event"
          description="Set the basics now. Prizes and entry packages can be added once the event is created."
        />
      </div>

      <CreateEventForm />
    </div>
  );
}
