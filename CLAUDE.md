# Lucky Draw v2 — project memory

A monthly charity lucky draw application originally built ~2 years ago in Next.js 13 + Supabase. Being rewritten from scratch in Next 15 + self-hosted Postgres on EC2. We're building this together, in phases, with the user reviewing each chunk.

## Where to look

- **`V2_SPEC.md`** — the build contract. Source of truth for goals, data model, every feature, API surface, deployment, and phased build plan. Read before changing anything significant.
- **`_v1/`** — full v1 source code, gitignored, kept locally for cribbing during the rewrite (especially animation timings, slot machine, tablet flow). To be deleted once we no longer need the reference (target: end of Phase 5).
- **`prisma/schema.prisma`** — the actual schema. `V2_SPEC.md §6` is kept in sync.

## Current status

In **Phase 1** (event/entrant CRUD). Phase 0 (foundations) committed.

Phases (from `V2_SPEC.md §13`):
- 0. Foundations — ✅ done
- 1. Events & entrants core — in progress
- 2. The draw (slot machine + presentation)
- 3. Tablet capture
- 4. Email
- 5. Public portal + reconciliation
- 6. Themability + polish
- 7. Hardening

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
