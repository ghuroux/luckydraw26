# Lucky Draw v2 — project memory

A monthly charity lucky draw application originally built ~2 years ago in Next.js 13 + Supabase. Being rewritten from scratch in Next 15 + self-hosted Postgres on EC2. We're building this together, in phases, with the user reviewing each chunk.

## Where to look

- **`V2_SPEC.md`** — the build contract. Source of truth for goals, data model, every feature, API surface, deployment, and phased build plan. Read before changing anything significant.
- **`_v1/`** — full v1 source code, gitignored, kept locally for cribbing during the rewrite (especially animation timings, slot machine, tablet flow). To be deleted once we no longer need the reference (target: end of Phase 5).
- **`prisma/schema.prisma`** — the actual schema. `V2_SPEC.md §6` is kept in sync.

## Current status

**Phase 2 shipped end-to-end.** The draw experience is live and projection-ready: crypto-strong RNG with pool-of-10 reveal + eligibility filter + pool-exhaustion fallback, SSE pub/sub with last-event-id replay, single-column reveal animation with piecewise easing across 4 phases (~7.5s total), Howler-driven audio (4 SFX + mute toggle), canvas-confetti, admin draw page with sonner toasts (Start/Test/Lock/Redraw/Clear/email-stub), test-draw rehearsal mode with TEST watermark, and presentation mode at `/events/[id]/presentation` with snapshot recovery on mount + live SSE mirror. **Next**: Phase 3 (tablet capture).

Three pieces of doc-debt reconciled at chunk close (commit pending in this session): `V2_SPEC.md §8.7` now reflects the 7.5s timing (was 6s), the corrected `clearWinner` semantics (unlocks an already-locked prize, not a no-op), and SoundBible as the actual audio source (Pixabay/Mixkit blocked WebFetch).

Phases (from `V2_SPEC.md §13`):
- 0. Foundations — ✅ done
- 1. Events & entrants core — ✅ done (1a–1g; 1h hygiene deferred)
- 2. The draw — ✅ done (2a–2f)
- 3. Tablet capture — ⏳ next
- 4. Email
- 5. Public portal + reconciliation (introduces schema migration: `Event.publicDescriptionHtml`, `Entry.voidedAt/voidReason`, `PublicEntryRateLimit`, `ENTRY_VOIDED`/`ENTRY_UNVOIDED`; **also surface SoundBible attribution** per Phase 2 audio sourcing)
- 6. Themability + polish (introduces schema migration: `Organisation.currencyCode/locale/timezone`, `Entrant.deletedAt`, `ENTRANT_DELETED`)
- 7. Hardening (ship-ready gate)

## Dev commands

```
npm run dev                          # next dev on http://localhost:3000
npm run build                        # next build
npm run typecheck                    # tsc --noEmit
npm run db:up                        # docker compose up -d postgres (port 5433)
npm run db:down
npm run db:psql                      # psql into the running container
npm run db:studio                    # Prisma Studio in browser
npm run db:migrate -- --name <name>  # create + apply a new migration
npm run seed:superadmin              # bootstrap first SUPERADMIN from .env
```

## Surprising / non-obvious things

- **Postgres runs on host port 5433**, not 5432. The user's machine has a host Postgres on 5432. docker-compose maps 5433→5432.
- **Prisma is pinned to `^6.0.0`**. v7 (released late 2025) requires a separate `prisma.config.ts` and driver adapter — our spec and better-auth's docs assume v6 patterns. Do not auto-upgrade.
- **Tailwind is v4** (CSS-first config). There is **no `tailwind.config.ts`** — theme tokens are declared via `@theme inline { ... }` in `app/globals.css`. PostCSS uses `@tailwindcss/postcss`. Don't add `autoprefixer` (Tailwind 4 includes it).
- **Component library is shadcn/ui v4** (built on Base UI, not Radix). Components live in `components/ui/` (owned, not a dep). Add new ones with `npx shadcn@latest add <name>`.
- **For a link styled as a button** (e.g. landing-page CTA), use `buttonVariants()` directly on `<Link>` — *not* `<Button render={<Link />}>`. Base UI's `<Button>` defaults to `nativeButton: true` and throws a runtime warning when rendered as a non-`<button>` element. Pattern: `<Link href="..." className={buttonVariants()}>...</Link>`.
- **Font is Geist** (Vercel's), wired via `next/font/google` in `app/layout.tsx` as a CSS variable `--font-sans`.
- **Brand defaults**: emerald-600 primary + amber-500 accent, overridden per Organisation at runtime via the `:root` tokens in `globals.css`. The default radius is `0.5rem` (8px).
- **Middleware is optimistic-only**. It checks for the session cookie's existence (no DB call), because Prisma can't run on the edge runtime. Real session validation happens server-side via `lib/rbac.ts`.
- **`useSearchParams()` requires a `<Suspense>` boundary** in Next 15 when the page is statically rendered. See `app/login/page.tsx` for the pattern.
- **better-auth's `additionalFields.role`** has `input: false`, so `signUpEmail` ignores any role passed in. The seed script does signup, then updates role separately.
- **The `jose` edge-runtime warning at build time is non-blocking** — it only affects deflate-compressed JWTs, which we never use.
- **`.next/` cache invalidation**: when changing the CSS pipeline (Tailwind version, postcss config, theme tokens) or installing/swapping major libs, dev mode may throw `Cannot find module './XXX.js'` from stale chunk references in the build manifest. Fix: stop dev, `rm -rf .next/`, restart `npm run dev`.
- **Schema deltas from v1**: cuid IDs throughout, `Prize.lockedAt` formalises winner-locking, `EntrySource` records origin, `Entry.paidAt` for reconciliation, `AuditLog` is cross-cutting.
- **shadcn `<Select>` `onValueChange` is `(value: string | null) => void`**, not `(string) => void`. When narrowing to a typed enum, wrap: `onValueChange={(v) => handler(v ?? "")}` (see `AddEntryButton.tsx` for the pattern).
- **Entry creation is OPEN-only.** DRAFT events accept no entries (server returns "Event is still in setup — open it before adding entries"). Same gate in the UI hides the Add Entry button.
- **Sequential ticket allocation** uses a transaction with retry-on-unique-conflict (up to 3 attempts) — see `lib/actions/entry.ts` `createEntry`. We do *not* use SERIALIZABLE isolation; the unique constraint + cheap retry covers the actual concurrency we expect.
- **Form prefill in dialogs**: use RHF's `values` prop (not `defaultValues`) so the dialog re-syncs when the editing target changes. See `PrizesManager.PrizeDialog`.
- **Underscore-prefixed folders are private in Next.js routing.** `app/api/_dev/foo/route.ts` will silently 404 — the `_dev` folder is excluded from routing entirely. Either pick a non-underscore name (`/api/dev/...`) or use parens for route groups (`/api/(dev)/...`, doesn't add to URL). Found this trying to ship a throwaway dev-only POST endpoint in Phase 2b.
- **SSE in-process pub/sub stashes channels on `globalThis`** (`__luckyDrawSseChannels` Map keyed by event-id). Without this, Next.js dev HMR wipes in-flight subscribers when a route module reloads. See `lib/sse.ts`. Each channel has an `EventEmitter` + a 50-event ring buffer for `Last-Event-ID` replay.
- **`<DrawStage>` remount key for SSE-driven flows**: `PresentationStage` uses a monotonic `revealKey` counter, not `${prizeId}-${attempt}`. React batches back-to-back `draw_started` + `draw_winner_revealed` `setPhase` calls into a single render — the intermediate `preparing` state never paints, the attempt counter resets through it invisibly, and the key would collide with the previous reveal's key. `landed=true` from the previous animation then carries over and `<WinnerCard>` appears mid-spin. Always-incrementing counter solves it cleanly.
- **`<NameReel>` `onLanded` / `onPhaseChange` captured in refs**, not in the animation effect's deps. The parent re-rendering when the winner card cross-fades in changes callback identity → effect deps change → cleanup cancels the RAF → effect re-runs → new animation starts from `t=0`. Looks like the reel "restarts" right after landing. Ref pattern keeps the latest callback reachable without re-triggering the effect.
- **Howler is client-only** (touches `window`/`AudioContext` at import). `components/draw/sounds.ts` is a `"use client"` singleton module — Howl instances live there so they're loaded once and reused across `<DrawStage>` mounts. Mute state is mirrored to `localStorage` (`luckydraw.muted`) and `Howler.mute(...)`.
- **Browser autoplay policy** silences audio until a user gesture. Admin draw page is fine — clicking Start counts. Presentation tab stays silent unless someone clicks on it; this is acceptable per the spec because the admin laptop drives the room audio.
- **Sound asset sourcing**: SoundBible's `https://soundbible.com/grab.php?id=XXX&type=mp3` endpoints return real MP3 files via plain `curl` (Pixabay and Mixkit blocked WebFetch with 403). Most SoundBible sounds are CC-Attribution 3.0 — Phase 5 needs a credit somewhere user-facing. See `public/sounds/LICENSES.md` for per-file provenance + 8 swap-in alternates in `_alternates/`.
- **Toast UX via sonner**: `<Toaster richColors closeButton />` mounted in the root layout (`app/layout.tsx`). Use `import { toast } from "sonner"` then `toast.success(...)` / `toast.error(...)` / `toast.info(...)`. The shadcn wrapper at `components/ui/sonner.tsx` themes it.
- **Test fixtures**: `npx tsx --env-file=.env scripts/seed-test-fixtures.ts` seeds three events (OPEN with full data + DRAFT empty + DRAWN with locked winners) plus 25 named entrants under `@fixtures.luckydraw.local`. Idempotent (skips events whose name already exists). `--clean` removes the fixture events (cascading) and any fixture entrants no longer referenced.

## Conventions

- **Files ≤300 lines.** v1's 1,325-line `draw/page.tsx` and 801-line `EventForm.tsx` are anti-patterns. Split aggressively — extract reels, winner cards, form sections into their own components.
- **Forms = react-hook-form + Zod.** No exceptions. Fixes v1's form-input bugs.
- **Mutations = server actions** colocated with the page that triggers them. REST routes only for: SSE streams, public entry submission, programmatic access (file upload, etc.).
- **All inputs validated with Zod at the boundary** (server action arg, route handler body, query params).
- **Comments**: default to none. Only add when the WHY is non-obvious (hidden constraint, subtle invariant, workaround). Never explain WHAT — well-named identifiers do that.
- **Theming**: use semantic Tailwind tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`/`text-primary-foreground`, `bg-accent`/`text-accent-foreground`, `bg-destructive`/`text-destructive`, `border-border`) — not raw colours. Defined as CSS variables in `app/globals.css` and exposed to Tailwind via `@theme inline`. Eventually driven by the `Organisation` row.
- **shadcn components first**: prefer `<Button>`, `<Input>`, `<Label>`, `<Card>` from `@/components/ui/` over hand-rolled markup. Add new shadcn components on demand (`npx shadcn@latest add table tabs select dialog toast` etc.) rather than upfront.
- **RBAC**: call `requireRole('ADMIN')` (or higher) at the top of every server action that mutates. UI gating via `<RoleGate minimum="...">` is convenience-only — never trust it for security.
- **Audit log**: any mutation that matters (event lifecycle, draws, locks, deletes, role changes) calls `logAudit({ action, entityType, entityId, metadata })`. The cross-cutting sweep happens in Phase 7.
- **Server actions live in `lib/actions/<entity>.ts`** — one file per top-level entity (`organisation`, `event`, `prize`, `package`, `entrant`, `entry`). All start with `"use server"`, all gate with `requireRole(...)` at the top, all return a discriminated `ActionResult` shape (`{ ok: true, data? }` or `{ ok: false, error, fieldErrors? }`).
- **Tabbed event navigation** is a layout (`app/(admin)/events/[id]/layout.tsx`) that fetches the event once and renders the persistent header (name + status badge + Edit + lifecycle actions) plus `<EventTabs>` (client, uses `usePathname` for the active state). Inner pages (`page.tsx`, `prizes`, `packages`, `entries`) are content-only — no breadcrumb, no header. Add a tab by pushing one entry into `EventTabs.tsx`'s `tabs` array.
- **Clickable table rows** — the pure-CSS stretched-link pattern doesn't work on `<tr>`: `<tr>` has `display: table-row` which doesn't establish a positioning context for absolute-positioned descendants in any major browser, so the link's `::after` escapes up to the next positioned ancestor (the table-container `<div className="relative">`) and all rows' overlays stack there — last one paints on top, wins every click. Instead: extract the `<TableBody>` to a client component, use `useRouter().push()` on `<TableRow onClick>`, keep a real `<Link>` in the primary cell with `onClick={(e) => e.stopPropagation()}` (preserves cmd-click "open in new tab", middle-click, right-click context menu, keyboard nav). See `app/(admin)/events/EventsTable.tsx`, `app/(admin)/entrants/EntrantsTable.tsx`.

## Working with the user

- **Plan before executing** for any non-trivial chunk of work. The user prefers a chat-plan (no doc) followed by execution with checkpoints.
- **Pause at natural checkpoints** within a phase so the user can verify in their browser before proceeding.
- **Confirm before destructive actions** — git resets, schema reset, anything that touches the GitHub repo, anything that would lose work.
- **Be honest about deviations** — if something didn't work as planned (e.g. Prisma 7 incompatibility, port collision), call it out plainly with what was changed and why.
- **The user uses npm in-house** — do not switch to pnpm or bun.
- **Do not test the UI yourself** — you cannot drive a browser. Hand the browser-test plan to the user explicitly when UI work is involved.

## When in doubt

1. Read `V2_SPEC.md` first
2. Then look at `_v1/` for the equivalent feature in v1 (especially UX details)
3. Then ask the user
