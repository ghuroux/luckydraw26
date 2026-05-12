# Lucky Draw

A monthly charity lucky draw application.

The full build contract for this project lives in [`V2_SPEC.md`](./V2_SPEC.md). Read that before changing anything significant — it covers goals, data model, every feature, the API surface, deployment, and the phased build plan.

New to the repo? [`CONTRIBUTING.md`](./CONTRIBUTING.md) has the dev-environment setup.

## Status

Phases 0–3 complete; Phase 4 (email) and adjacent hardening work in progress.

Currently usable:

- Admin app with org settings, event CRUD (Overview / Entries / Prizes / Packages / Draw tabs), entrant directory, lifecycle transitions, audit logging
- The draw — crypto-strong RNG with one-win-per-entrant filter and pool-exhaustion fallback, single-column reveal animation (~7.5s, four-phase easing), Howler audio, canvas-confetti
- Presentation mode at `/events/[id]/presentation` mirrors admin via SSE, with prize lineup / winners list snapshot recovery on mount
- Test draw mode for rehearsal (TEST watermark, no persistence)
- Tablet capture at `/events/[id]/tablet-capture` — fullscreen, org-themed, STAFF-gated; five-step flow with hybrid entrant search, package + individual combos, CASH/CARD payment capture, idle auto-logout
- User management at `/settings/users` (SUPERADMIN-only) — create accounts with credentials shown once and copyable, change roles, deactivate / reactivate with immediate session kill. New users are forced through `/change-password` on first sign-in. The public sign-up endpoint is disabled; all accounts come through this flow
- Add entrant button on `/entrants` for pre-loading supporters before they buy a ticket

Next: **Phase 4 — Email** (winner emails + reconciliation prompts), then Phase 5 (public portal + reconciliation).
