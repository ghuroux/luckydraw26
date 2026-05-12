# Contributing

Short setup guide for getting a local dev environment running. Read [`CLAUDE.md`](./CLAUDE.md) and [`V2_SPEC.md`](./V2_SPEC.md) before changing anything significant — the first covers conventions and gotchas, the second is the build contract.

## Prerequisites

- **Node 20+** (24 is fine).
- **npm** — do not swap in pnpm or bun.
- **Docker Desktop** — local Postgres runs in a container.
- Git access to the repo.

Mac/Linux assumed for the shell commands; on Windows use PowerShell/WSL equivalents.

## Setup

```bash
# 1. Clone & install
git clone <repo-url> lucky-draw
cd lucky-draw
npm install

# 2. Env file
cp .env.example .env
# Edit .env and fill in at minimum:
#   BETTER_AUTH_SECRET   — generate with: openssl rand -base64 32
#   BOOTSTRAP_EMAIL      — your email (becomes the first SUPERADMIN)
#   BOOTSTRAP_PASSWORD   — any reasonable password; you'll change it on first sign-in
# Leave DATABASE_URL as-is for local dev.
# SMTP_* can stay blank — dev falls back to logging emails to stdout.

# 3. Start Postgres (Docker)
npm run db:up                            # boots Postgres on host port 5433 (NOT 5432)

# 4. Apply migrations + generate the Prisma client
npx prisma migrate deploy
npx prisma generate

# 5. Bootstrap the first admin user
npm run seed:superadmin                  # reads BOOTSTRAP_* from .env

# 6. (Optional) Seed test fixtures
npx tsx --env-file=.env scripts/seed-test-fixtures.ts
# Creates 3 events (OPEN with full data, DRAFT empty, DRAWN with locked winners)
# + 25 named entrants. Idempotent. Add --clean to remove them.

# 7. Run the dev server
npm run dev                              # http://localhost:3000
```

## First steps in the app

- Sign in at `/login` with the `BOOTSTRAP_EMAIL` / `BOOTSTRAP_PASSWORD` from `.env`.
- You'll be forced through `/change-password` on first sign-in.
- From there: `/dashboard` → settings, events, entrants.

## Common commands

```bash
npm run dev                              # dev server
npm run build                            # production build (runs prisma generate first)
npm run typecheck                        # tsc --noEmit
npm run db:psql                          # psql into the running container
npm run db:studio                        # Prisma Studio in browser
npm run db:migrate -- --name <name>      # create + apply a new migration
npm run db:down                          # stop Postgres
npm run email:preview                    # react-email preview server on :3001
```

## Gotchas worth knowing upfront

- **Postgres runs on host port 5433**, not 5432. The compose file maps it that way because many devs already have a host Postgres on 5432.
- **Prisma is pinned to `^6.0.0`** — don't run `npm update` blindly; Prisma 7 needs different config and a driver adapter.
- **Tailwind is v4** (CSS-first). There is **no `tailwind.config.ts`** — theme tokens live in `app/globals.css` under `@theme inline { ... }`. PostCSS uses `@tailwindcss/postcss`. Don't add `autoprefixer`.
- **shadcn/ui v4** (Base UI under the hood, not Radix). Components in `components/ui/` are *owned*, not a dep. Add new ones with `npx shadcn@latest add <name>`.
- If you change the CSS pipeline (Tailwind version, postcss config, theme tokens) or swap a major lib and dev mode throws `Cannot find module './XXX.js'`, run `rm -rf .next/` and restart `npm run dev`.
- **`useSearchParams()` requires a `<Suspense>` boundary** in Next 15 when the page is statically rendered. See `app/login/page.tsx` for the pattern.
- **The `jose` edge-runtime warning at build time is non-blocking** — it only affects deflate-compressed JWTs, which we never use.

## Conventions (cheat sheet)

The full list lives in [`CLAUDE.md`](./CLAUDE.md). Highlights:

- **Files ≤300 lines.** Split aggressively.
- **Forms** = react-hook-form + Zod, no exceptions.
- **Mutations** = server actions colocated with the page that triggers them. REST routes only for SSE streams, public entry submission, programmatic access.
- **All inputs validated with Zod at the boundary.**
- **Comments**: default to none. Only add when the *why* is non-obvious.
- **Theming**: use semantic Tailwind tokens (`bg-background`, `text-foreground`, `bg-primary`, etc.) — not raw colours.
- **RBAC**: call `requireRole('ADMIN')` (or higher) at the top of every server action that mutates. UI gating via `<RoleGate>` is convenience-only — never trust it for security.
- **Server actions** live in `lib/actions/<entity>.ts`, one file per top-level entity, all gated with `requireRole(...)` at the top, all return a discriminated `ActionResult` shape.
