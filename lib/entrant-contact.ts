// Helpers for detecting entrants whose contact details came in via the
// import pipeline as placeholders. The GOS 2026 tee-sheet import (and any
// future tee-sheet imports) writes a synthetic `<first>.<last>@<event>.placeholder`
// email when no real contact info is on the sheet — Entrant.email is unique
// and required, so we need *something* there. This file is the single source
// of truth for recognising that pattern.

export function isPlaceholderEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(".placeholder");
}

/** True when the email on file is a placeholder, i.e. we don't have a real one. */
export function missingEmail(entrant: { email: string }): boolean {
  return isPlaceholderEmail(entrant.email);
}

/** True when no phone is on file. */
export function missingPhone(entrant: { phone: string | null }): boolean {
  return !entrant.phone?.trim();
}

/**
 * True when an entrant has no real way to be contacted — placeholder email
 * AND no phone number. Hard gate: must capture at least one before they can
 * buy a ticket. When only one channel is missing we still soft-prompt for
 * the other but don't block.
 */
export function needsContactCapture(entrant: {
  email: string;
  phone: string | null;
}): boolean {
  return missingEmail(entrant) && missingPhone(entrant);
}
