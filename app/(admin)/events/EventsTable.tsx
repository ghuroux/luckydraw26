"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EventStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<EventStatus, "default" | "secondary" | "outline"> = {
  DRAFT: "outline",
  OPEN: "default",
  CLOSED: "secondary",
  DRAWN: "secondary",
};

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
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
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
                className="cursor-pointer hover:bg-muted/50"
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
                  <Badge variant={STATUS_VARIANT[event.status]}>
                    {event.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {event._count.entries}
                </TableCell>
                <TableCell className="text-right tabular-nums">
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
