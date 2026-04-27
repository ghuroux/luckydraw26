# Lucky Draw

A monthly charity lucky draw application.

The full build contract for this project lives in [`V2_SPEC.md`](./V2_SPEC.md). Read that before changing anything significant — it covers goals, data model, every feature, the API surface, deployment, and the phased build plan.

## Status

Phases 0–2 complete. Currently usable:

- Admin app with org settings, event CRUD (Overview / Entries / Prizes / Packages / Draw tabs), entrant directory, lifecycle transitions, audit logging
- The draw — crypto-strong RNG with one-win-per-entrant filter and pool-exhaustion fallback, single-column reveal animation (~7.5s, four-phase easing), Howler audio, canvas-confetti
- Presentation mode at `/events/[id]/presentation` mirrors admin via SSE, with prize lineup / winners list snapshot recovery on mount
- Test draw mode for rehearsal (TEST watermark, no persistence)

Next: **Phase 3 — Tablet capture** (touch-friendly entry flow for in-event sales).
