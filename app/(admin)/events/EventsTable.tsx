"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EventStatus } from "@prisma/client";

import { StatusBadge } from "@/components/shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { eventStatusLabel, eventStatusTone } from "@/lib/event-status";

export interface EventRow {
  id: string;
  name: string;
  date: Date | null;
  status: EventStatus;
  _count: { entries: number; prizes: number };
}

export function EventsTable({ events }: { events: EventRow[] }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/8">
      <Table>
        <TableHeader>
          <TableRow className="bg-surface-sunken/60 hover:bg-surface-sunken/60">
            <TableHead>Name</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Entries</TableHead>
            <TableHead className="text-right">Prizes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => {
            const href = `/events/${event.id}`;
            return (
              <TableRow
                key={event.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(href)}
              >
                <TableCell className="font-medium">
                  <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline"
                  >
                    {event.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {event.date
                    ? new Date(event.date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    tone={eventStatusTone(event.status)}
                    dot={event.status === "OPEN"}
                  >
                    {eventStatusLabel(event.status)}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {event._count.entries}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {event._count.prizes}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
