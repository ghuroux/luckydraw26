// Helpers for detecting entrants whose contact details came in via the
// import pipeline as placeholders. The GOS 2026 tee-sheet import (and any
// future tee-sheet imports) writes a synthetic `<first>.<last>@<event>.placeholder`
// email when no real contact info is on the sheet — Entrant.email is unique
// and required, so we need *something* there. This file is the single source
// of truth for recognising that pattern.

export function isPlaceholderEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(".placeholder");
}

/**
 * True when an entrant has no real way to be contacted — placeholder email
 * AND no phone number. We need to capture at least one before they can buy
 * a ticket (otherwise we can't notify them if they win).
 */
export function needsContactCapture(entrant: {
  email: string;
  phone: string | null;
}): boolean {
  return isPlaceholderEmail(entrant.email) && !entrant.phone?.trim();
}
