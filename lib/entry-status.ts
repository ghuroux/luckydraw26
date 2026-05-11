import type { EntrySource } from "@prisma/client";

import type { StatusTone } from "@/components/shell";

export function entrySourceTone(source: EntrySource): StatusTone {
  switch (source) {
    case "ADMIN":
      return "muted";
    case "TABLET":
      return "info";
    case "PUBLIC":
      return "neutral";
  }
}

export function entrySourceLabel(source: EntrySource): string {
  switch (source) {
    case "ADMIN":
      return "Admin";
    case "TABLET":
      return "Tablet";
    case "PUBLIC":
      return "Public";
  }
}
