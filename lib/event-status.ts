import type { EventStatus } from "@prisma/client";

import type { StatusTone } from "@/components/shell";

export function eventStatusTone(status: EventStatus): StatusTone {
  switch (status) {
    case "DRAFT":
      return "muted";
    case "OPEN":
      return "success";
    case "CLOSED":
      return "info";
    case "DRAWN":
      return "neutral";
  }
}

export function eventStatusLabel(status: EventStatus): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "OPEN":
      return "Open";
    case "CLOSED":
      return "Closed";
    case "DRAWN":
      return "Drawn";
  }
}
