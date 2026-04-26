"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface EntrantRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  createdAt: Date;
  entries: { createdAt: Date }[];
  _count: { entries: number };
}

export function EntrantsTable({ entrants }: { entrants: EntrantRow[] }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Entries</TableHead>
            <TableHead>Last activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entrants.map((entrant) => {
            const lastActivity = entrant.entries[0]?.createdAt ?? entrant.createdAt;
            const href = `/entrants/${entrant.id}`;
            return (
              <TableRow
                key={entrant.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(href)}
              >
                <TableCell className="font-medium">
                  <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline"
                  >
                    {entrant.firstName} {entrant.lastName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {entrant.email}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {entrant.phone ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {entrant._count.entries}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(lastActivity).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
