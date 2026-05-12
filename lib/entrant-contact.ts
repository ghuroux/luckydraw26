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
 * The email to surface in the admin UI / exports. Returns null when the
 * stored email is a placeholder so callers can render their own "no email"
 * affordance (muted hint, blank CSV cell, etc.) rather than leak a fake
 * address that would bounce if anyone tried to use it.
 */
export function displayEmail(entrant: { email: string }): string | null {
  return isPlaceholderEmail(entrant.email) ? null : entrant.email;
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
 * True when an entrant is missing EITHER a real email or a phone. Hard gate:
 * post-demo feedback requires both channels on file before a ticket sale
 * can proceed on the tablet, so any missing channel blocks Next until
 * captured.
 */
export function needsContactCapture(entrant: {
  email: string;
  phone: string | null;
}): boolean {
  return missingEmail(entrant) || missingPhone(entrant);
}
