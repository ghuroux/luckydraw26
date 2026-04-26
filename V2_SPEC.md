# Lucky Draw v2 — Specification

A from-scratch rewrite of the monthly charity lucky draw application. This document is the build contract: it covers what we are building, the data model, every user-facing feature, the API, deployment, data migration from v1, and a phased build plan.

---

## 1. Operating context — how the day actually runs

Anyone attending the golf day can buy as many lucky draw tickets as they want; more tickets = better odds of winning. Tickets are sold throughout the day, often at speed during peak windows (registration, lunch, prize-giving). The application's purpose is to **automate everything that can be automated** so organisers can focus on running the event itself, not on paperwork.

In practice, a typical event runs like this:

- **Pre-event** — organisers publish the event to a public URL with prizes, pricing, and branding. Attendees who want to skip queues on the day can buy tickets online in advance.
- **During the event** — roving staff sell tickets on iPads via the tablet capture flow. Each sale takes seconds: enter contact details, pick a quantity or a package, hand the device over for payment, capture the payment reference, done. Ticket numbers are assigned automatically; entry-confirmation emails go out without anyone having to remember.
- **Prize-giving** — the MC opens presentation mode on the projector. The admin runs the draw from a laptop; the slot machine spins on the big screen for the audience to see, the winner is revealed, confetti, lock in. Repeat per prize. Winner emails fire automatically. No spreadsheets, no scribbled lists, no "wait, did we already draw that one?".
- **Post-event** — winner list and leaderboard are already live on the public page; the admin reconciles any unpaid public entries and exports records.

Design implications that thread through the rest of this spec:

- The **tablet capture flow is the hot path** — every extra tap costs organisers real time during peak windows
- The **draw must degrade gracefully** if SSE/wifi drops (golf clubs have notoriously patchy connectivity); admin and presentation views must reconcile state on reconnect
- **Public entry on a phone browser must be near-frictionless** — three screens max
- **Nothing an operator does on the day should require a follow-up step** they have to remember (emails auto-send, ticket numbers auto-assign, winners auto-record)

## 2. Goals

- Rebuild v1 cleanly with smaller, focused files and modern tooling
- Run on self-hosted Postgres (EC2) instead of Supabase
- Preserve every feature that exists or was speced in v1, including the unfinished public-event-publishing portal
- Make the brand themeable (logo + colour palette) rather than hard-coded to one charity
- Be easy for the two of us to maintain and extend incrementally

## 3. Non-goals (for now)

- Multi-tenant SaaS. The app supports **one organisation** at a time. Themeable, but not multi-org.
- Payment processing in-app. Tablet flow hands payment off to a separate device (same as v1).
- SMS notifications, social sharing, analytics dashboards, audit logs. Defer.
- WCAG-grade accessibility audit. We will follow sensible defaults but not certify.
- Mobile app / PWA. Web-responsive only.
- Cryptographic auditability of the draw beyond using a CSPRNG.

## 4. Tech stack

| Layer            | Choice                          | Why                                                                 |
|------------------|---------------------------------|---------------------------------------------------------------------|
| Framework        | Next.js 15 (App Router)         | One repo, server actions for forms, built-in SSE, image optimization |
| UI               | React 19 + TypeScript 5         | —                                                                   |
| Styling          | Tailwind CSS 4 + shadcn/ui v4   | CSS-first config (`@theme` in `globals.css`); shadcn built on Base UI |
| Forms / validation | react-hook-form + Zod         | Eliminates v1's form-input bugs                                      |
| ORM              | Prisma 6                        | Continuity with v1 schema; well-known                                |
| Database         | PostgreSQL 16 (self-hosted EC2) | Owned by your devops team                                            |
| Auth             | better-auth                     | Lives in our Postgres, handles sessions/CSRF, supports roles         |
| Email            | NodeMailer (SMTP)               | Same as v1                                                           |
| Rich text        | Tiptap                          | For public event descriptions                                        |
| File storage     | Local disk (configurable to S3) | Devops can mount a volume; S3 driver behind the same interface      |
| Animation        | framer-motion + canvas-confetti | Slot machine + winner celebrations                                   |
| Audio            | howler.js (use-sound wrapper)   | Slot machine spin/stop/win sounds                                    |
| Real-time        | Server-Sent Events (SSE)        | Presentation screen mirrors admin draw view                          |
| RNG              | `crypto.randomInt`              | v1 used `Math.random` despite README claim                           |
| Container        | Docker                          | Devops will run via standard image                                   |

## 5. Architecture

Single Next.js app, deployed as one container next to Postgres on EC2.

```
┌───────────────────────────────────────────────────┐
│  Browser (admin / MC / tablet / public entrant)   │
└───────────────────────────────┬───────────────────┘
                                │ HTTPS
┌───────────────────────────────▼───────────────────┐
│  Next.js app (Node container on EC2)              │
│  • RSC pages + server actions                     │
│  • API route handlers (REST + SSE)                │
│  • better-auth                                    │
│  • Prisma → Postgres                              │
│  • NodeMailer → SMTP relay                        │
│  • File storage (local volume or S3)              │
└───────────────────────────────┬───────────────────┘
                                │
                ┌───────────────▼────────────────┐
                │  PostgreSQL 16 (same VPC/host) │
                └────────────────────────────────┘
```

Key principles:
- Prefer **server actions** for mutations from forms; reserve REST routes for things called by non-form clients (the public portal entry submission, the SSE stream, future webhooks)
- No file in the codebase exceeds ~300 lines. v1's `draw/page.tsx` (1,325 lines) and `EventForm.tsx` (801) are anti-targets — split aggressively
- All inputs validated with Zod at the boundary (server action arg, route handler body, query params)
- All user-facing strings flow through one place per page so future i18n is mechanical

## 6. Data model (Prisma)

Carries v1's domain forward, adds organisation/theming, public-portal fields, and proper auth tables.

```prisma
// ---------- Auth (better-auth managed) ----------
model User {
  id            String     @id
  email         String     @unique
  emailVerified Boolean    @default(false)
  name          String
  role          Role       @default(STAFF)
  image         String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  sessions      Session[]
  accounts      Account[]
  auditLogs     AuditLog[]
}

model Session {
  id        String   @id
  userId    String
  expiresAt DateTime
  token     String   @unique
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Account holds the password hash for email/password and OAuth tokens for any
// future providers. The OAuth-related fields are unused today but match the
// shape better-auth expects.
model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  password              String?
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([providerId, accountId])
}

model Verification {
  id         String    @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime? @default(now())
  updatedAt  DateTime? @updatedAt
}

enum Role {
  SUPERADMIN  // can manage users, org settings, themes
  ADMIN       // can manage events, entrants, draws
  STAFF       // can collect entries (tablet capture); cannot draw
}

// ---------- Org / theming ----------
model Organisation {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  logoUrl       String?
  primaryColor  String   @default("#1f2937")
  accentColor   String   @default("#10b981")
  bgPattern     String?  // optional URL to repeating bg image
  contactEmail  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  events        Event[]
}
// v2 ships with one Organisation row; no UI to create more.

// ---------- Domain ----------
model Entrant {
  id             String    @id @default(cuid())
  firstName      String
  lastName       String
  email          String    @unique
  phone          String?
  dateOfBirth    DateTime?
  sponsorShareOptIn Boolean @default(false)  // may we share contact details with event sponsors
  smsOptIn          Boolean @default(false)  // collected now; SMS feature deferred
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  entries        Entry[]
  @@index([lastName, firstName])
  @@index([createdAt])
}

model Event {
  id                 String       @id @default(cuid())
  organisationId     String
  organisation       Organisation @relation(fields: [organisationId], references: [id])
  name               String
  description        String?       // admin-facing internal description
  date               DateTime?
  drawTime           String?
  entryCost          Decimal       @db.Decimal(10, 2) @default(0)
  prizePool          Decimal?      @db.Decimal(10, 2)
  status             EventStatus   @default(DRAFT)
  drawnAt            DateTime?

  // Public portal
  isPublished        Boolean       @default(false)
  publishedSlug      String?       @unique
  publicDescription  Json?         // Tiptap JSON
  publicHeroImage    String?
  themeOverride      Json?         // optional per-event theme overrides

  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  entries            Entry[]
  packages           EntryPackage[]
  prizes             Prize[]

  @@index([status])
  @@index([organisationId, status])
  @@index([date])
}

enum EventStatus {
  DRAFT
  OPEN
  CLOSED
  DRAWN
}

model EntryPackage {
  id        String   @id @default(cuid())
  eventId   String
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  label     String   // "5 entries for R200"
  quantity  Int
  cost      Decimal  @db.Decimal(10, 2)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  entries   Entry[]
}

model Entry {
  id              String        @id @default(cuid())
  eventId         String
  entrantId       String
  ticketNumber    Int           // sequential per event
  packageId       String?
  packageEntryNum Int?          // position within the package (1..quantity)
  donationAmount  Decimal?      @db.Decimal(10, 2)
  paymentRef      String?       // free-text from tablet flow
  paidAt          DateTime?     // null = unreconciled (typically PUBLIC source); set automatically for ADMIN/TABLET when ref captured
  source          EntrySource   @default(ADMIN)
  createdAt       DateTime      @default(now())

  event           Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)
  entrant         Entrant       @relation(fields: [entrantId], references: [id])
  package         EntryPackage? @relation(fields: [packageId], references: [id])
  prizeWon        Prize?        @relation("PrizeWinner")

  @@unique([eventId, ticketNumber])
  @@index([eventId, createdAt])
  @@index([entrantId])
}

enum EntrySource {
  ADMIN     // staff entered via dashboard
  TABLET    // captured via tablet flow at the event
  PUBLIC    // submitted via public portal
}

model Prize {
  id             String   @id @default(cuid())
  eventId        String
  name           String
  description    String?
  order          Int      @default(0)
  imageUrl       String?
  imageAlt       String?
  winningEntryId String?  @unique
  lockedAt       DateTime?  // set when winner is "locked in" — blocks redraws
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  event          Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  winningEntry   Entry?   @relation("PrizeWinner", fields: [winningEntryId], references: [id])

  @@index([eventId, order])
}

model EmailLog {
  id        String   @id @default(cuid())
  to        String
  subject   String
  template  String
  context   Json
  sentAt    DateTime?
  error     String?
  createdAt DateTime @default(now())
}

model AuditLog {
  id         String      @id @default(cuid())
  userId     String?     // null for system actions
  user       User?       @relation(fields: [userId], references: [id])
  action     AuditAction
  entityType String      // "Event" | "Prize" | "Entry" | "Entrant" | "User" | "Organisation"
  entityId   String
  metadata   Json?       // free-form: before/after, payload, etc.
  createdAt  DateTime    @default(now())

  @@index([entityType, entityId])
  @@index([userId, createdAt])
  @@index([createdAt])
}

enum AuditAction {
  EVENT_CREATED
  EVENT_UPDATED
  EVENT_OPENED
  EVENT_CLOSED
  EVENT_REOPENED
  EVENT_DELETED
  EVENT_PUBLISHED
  EVENT_UNPUBLISHED
  PRIZE_CREATED
  PRIZE_UPDATED
  PRIZE_DELETED
  PRIZE_DRAWN          // winner picked (live)
  PRIZE_TEST_DRAWN     // winner picked in test mode (not persisted)
  WINNER_LOCKED
  WINNER_CLEARED
  WINNER_NOTIFIED
  ENTRY_CREATED
  ENTRY_DELETED
  ENTRY_RECONCILED     // paidAt set
  ENTRANT_UPDATED
  USER_INVITED
  USER_ROLE_CHANGED
  USER_DEACTIVATED
  ORG_UPDATED
}
```

Notable changes from v1:
- IDs everywhere are `cuid()` strings. Removes the `entries.id` / `winningEntryId` int↔string awkwardness from v1.
- `ticketNumber` is unique-per-event and explicit, not derived
- `Prize.lockedAt` formalises the "winner locked, no redraw" state
- `EntrySource` records where an entry came from
- `Entry.paidAt` supports the manual-reconciliation flow for public entries
- `Entrant.sponsorShareOptIn` records consent to share contact details with event sponsors (the actual revenue path for the charity)
- `Entrant.smsOptIn` collected now even though SMS is deferred
- `EmailLog` gives us a basic outbox for retries and a UI
- `AuditLog` records who did what — surfaced as a SUPERADMIN-only page

## 7. Auth & roles

**Library**: better-auth, configured against our Postgres via Prisma adapter. Email + password only. No magic links or OAuth in v2.

**Roles**:
- `SUPERADMIN` — manage users, organisation settings, theme, danger-zone (event delete)
- `ADMIN` — full event lifecycle (create, open/close, draw, redraw)
- `STAFF` — capture entries (tablet flow), view dashboards; cannot draw, edit packages, publish, or delete

**Bootstrap**: a `pnpm seed:superadmin` script reads `BOOTSTRAP_EMAIL` / `BOOTSTRAP_PASSWORD` from env and creates the first SUPERADMIN. After that, SUPERADMIN invites others via the user management page (which sends an email with a temporary password).

**Enforcement**:
- Server actions and API routes call `requireRole('ADMIN')` (or higher) at the top
- One `<RoleGate role="ADMIN">` component for UI gating — no scattered `if (role === ...)` checks
- Don't trust UI gating alone; always re-check in the action

**Sessions**: HTTP-only, SameSite=Lax cookie. 30-day rolling expiry.

## 8. Feature spec

### 8.1 Dashboard (`/dashboard`)
- Summary cards: open events, total entries this month, upcoming draws
- "Recent winners" spotlight (last 6, across events)
- Quick action: create event
- Visible to all roles; STAFF sees a slimmer version (no totals across events)

### 8.2 Organisation settings (`/settings/organisation`) — SUPERADMIN
- Edit name, contact email
- Upload logo (stored via storage driver, returns URL)
- Pick primary + accent colours (color picker with live preview)
- Optional repeating background pattern image
- "View public portal preview" link

### 8.3 User management (`/settings/users`) — SUPERADMIN
- List users with role badges
- Invite user (email + role) — sends temporary-password email
- Change role, deactivate user, force password reset

### 8.4 Events
**List (`/events`)**: filter by status (Draft / Open / Closed / Drawn), search by name. Past events on `/events/past` (drawn > 60 days old).

**Create (`/events/new`)** and **edit (`/events/[id]/edit`)** — single form, broken into tabs:
- *Basics*: name, internal description, date, draw time, entry cost, prize pool
- *Prizes*: ordered list, add/edit/remove, image upload, drag to reorder
- *Packages*: list of bulk-entry packages (label, quantity, cost, active)
- *Public portal*: toggle published, slug, rich text description (Tiptap), hero image, theme overrides — see 8.8

**Lifecycle** (`EventActions`):
- `DRAFT → OPEN` (open for entries) — requires at least one prize
- `OPEN → CLOSED` (no more entries accepted)
- `CLOSED → DRAWN` (via the draw flow)
- Reopen from `CLOSED → OPEN` allowed only if not drawn
- Delete only allowed in `DRAFT`; SUPERADMIN can force-delete with confirm

**Detail (`/events/[id]`)**: tabbed view — overview, entries list, prizes, packages, draw, presentation, public portal status, danger zone.

### 8.5 Entrants (`/entrants`)
- Searchable, paginated list (server-side pagination — fix v1's perf hole)
- Click through to entrant profile: contact info, full entry history across events, total spent
- CSV export (already in v1)
- Inline edit of contact fields

### 8.6 Entries
**Add (admin form, `/events/[id]` entry tab)**:
- Search-as-you-type entrant by name/email/phone
- If found, select; if not, "Create new entrant" inline (with sponsor-share + SMS opt-in checkboxes)
- Choose individual entry, package, or both
- Optional donation amount
- Optional payment reference (sets `paidAt` if provided)
- On submit, server allocates `ticketNumber = max + 1` for that event in a transaction
- v1 bug to avoid: do **not** auto-fill email when selecting an existing entrant

**Tablet capture (`/events/[id]/tablet-capture`)**:
- Fullscreen, simplified UI tuned for iPad portrait
- Step 1: collect entrant details (with autocomplete on email); sponsor-share + SMS opt-in checkboxes
- Step 2: pick package or N individual entries; show running total
- Step 3: payment-handover screen — shows amount + payment ref input; says "Hand the device to the customer / process payment on the other device, then enter ref"
- Step 4: confirmation with assigned ticket numbers, "Capture another entry" button
- On submit, `paidAt` is set to `now()` (tablet entries are paid by the time the ref is captured)
- Available to STAFF; no role gate beyond auth
- Full-screen mode + auto-logout after N minutes idle (configurable)

**Reconciliation (`/events/[id]/reconciliation`)** — ADMIN:
- Lists entries with `paidAt = null` (typically `source = PUBLIC`)
- Shows entrant, ticket numbers, amount owed, submitted-at, payment ref input inline
- "Mark paid" sets `paidAt = now()` and stores the ref; bulk-select supported
- "Void entry" deletes (audit-logged) for no-shows
- Counter at top: outstanding count + outstanding amount

### 8.7 Draw experience

**Admin draw (`/events/[id]/draw`)** — for the operator:
- Lists prizes with current status (no winner / winner / locked)
- "Start draw for [Prize Name]" button per un-won prize
- Triggers slot-machine animation client-side, fed by a server-picked winner
- After spin: shows winner card with "Lock in winner" + "Redraw" buttons
- "Lock in winner" sets `Prize.lockedAt`, disables further redraws for that prize
- "Redraw" picks a new winner (only if not locked)
- "Send winner email" button (manual, also auto-sent on lock if configured)

**Selection algorithm**:
- Use `crypto.randomInt(0, eligibleEntries.length)`
- Eligible = entries whose entrant has not already won a prize at this event (one-win-per-entrant rule, same as v1)
- Selection is weighted by entry count automatically — entrants with more entries appear more times in the eligible list
- Server returns the winning entry ID + a list of "decoy" entrant names for the slot-machine reels (so the animation looks plausible without revealing the result)

**Presentation mode (`/events/[id]/presentation`)** — for projection:
- Clean, full-bleed UI sized for projection (16:9, large type, themed)
- Mirrors the admin draw via SSE — when admin clicks "Start draw", the presentation screen runs the same animation in sync
- Confetti + winner sound on lock-in
- No interactive controls; read-only

**SSE channel** (`/api/events/[id]/stream`):
- Events: `draw_started`, `draw_winner_revealed`, `winner_locked`, `winner_cleared`, `prize_updated`
- Auth-gated (admin/staff only)
- Reconnect with last-event-id for resilience

**Redraw / clear winner**:
- `POST /api/events/[id]/prizes/[prizeId]/clear-winner` — only if not locked, ADMIN only
- Spec change from v1: explicit `lockedAt` rather than relying on `winningEntryId` presence

**Test draw mode** (rehearsal before going live):
- "Test draw" button next to "Start draw"; only available when event is `OPEN` or `CLOSED` and prize has no winner
- Picks a winner using the live algorithm but **does not persist** — no `winningEntryId`, no `lockedAt`, no email
- UI is decorated with a "TEST" watermark; presentation mode shows the same watermark so the audience isn't misled if it's accidentally shown
- SSE event is `draw_test_started` / `draw_test_winner_revealed` (separate channel from live so a rehearsal can't be confused with the real thing)
- Logged as `PRIZE_TEST_DRAWN` in the audit log
- Lets the MC rehearse the slot machine with real entries and the projector wired up

### 8.8 Public event portal

This is the v1-speced-but-unbuilt feature.

**Publishing** (in event edit, *Public portal* tab):
- Toggle `isPublished`
- Auto-suggest `publishedSlug` from name; user can edit
- Rich-text description editor (Tiptap) with: headings, bold/italic, links, bullet/numbered lists, images
- Hero image upload
- Per-event theme overrides (primary/accent colours), defaults to org theme
- "Preview" button opens the public page in a new tab in draft mode (signed token URL)

**Public page (`/p/[slug]`)** — unauthenticated:
- Themed layout (org logo + colour palette, optionally overridden by event)
- Renders Tiptap content, prizes (image + name + description), entry pricing (cost + packages)
- Entry CTA → entry form
- Read-only after event closes; shows winners after `DRAWN`

**Public entry form (`/p/[slug]/enter`)**:
- Collects entrant details (matches Entrant schema)
- Choose package or N individual entries
- Sponsor-share opt-in + SMS opt-in checkboxes (each with a short, plain-English explanation alongside)
- Honeypot + simple rate limit (per-IP, in-memory or DB)
- No payment integration: submission creates entries with `source = PUBLIC`, `paymentRef = null`, `paidAt = null`. Admin reconciles via the reconciliation page (8.6).
- Confirmation page with ticket numbers + email confirmation, with a clear note that payment is settled separately

### 8.9 Email notifications
- Templates (React Email or simple HTML strings):
  - `entry-confirmation` — sent on public entry submission
  - `winner-notification` — sent when `Prize.lockedAt` set (or manually triggered)
  - `user-invitation` — sent by SUPERADMIN flow
  - `password-reset` — better-auth template
- All sends recorded in `EmailLog` with retry-on-failure (admin-triggered "Retry" from the log UI)
- Templates render with org theme (logo + colour) for brand consistency

### 8.10 Leaderboard (`/events/[id]/leaderboard`)
- Top entrants by entry count for the event, paginated
- Shown on the public portal too if event is published

### 8.11 Audit log (`/settings/audit-log`) — SUPERADMIN

- Reverse-chronological feed of `AuditLog` entries
- Filters: actor (user), action, entity type, date range
- Click an entry to see metadata payload (before/after diff for updates)
- Backed by a `logAudit({ action, entityType, entityId, metadata })` helper called from server actions and key API routes
- Helper grabs the current user from the session automatically; system-triggered actions pass `userId = null`
- Cross-cutting concern — wired in throughout, with a Phase 7 sweep to ensure coverage

### 8.12 Theming
- Tailwind CSS variables (`--color-primary`, `--color-accent`, etc.) set on `<html>` from the active org/event theme
- Tailwind config exposes `bg-primary`, `text-primary`, etc. via `colors: { primary: 'rgb(var(--color-primary) / <alpha-value>)' }`
- Dark mode: `class` strategy, toggle in nav, persisted in localStorage. Forms and inputs use semantic `bg-surface` / `text-foreground` tokens — fixes the dark-mode text bugs from v1.
- All theming flows from one `getActiveTheme()` server function so future per-event override is one place

## 9. API surface

Server actions cover most form mutations. REST endpoints are reserved for: SSE, public entry submission, programmatic access. Sketch:

```
GET    /api/events/[id]/stream                    — SSE
POST   /api/p/[slug]/enter                        — public entry submission
POST   /api/events/[id]/draw                      — pick winner for next prize (admin)
POST   /api/events/[id]/prizes/[prizeId]/lock     — lock winner
POST   /api/events/[id]/prizes/[prizeId]/clear    — clear/redraw winner
POST   /api/events/[id]/prizes/[prizeId]/notify   — send winner email
GET    /api/entrants/search?q=...                 — typeahead
POST   /api/upload                                — file upload (returns URL)
```

Everything else goes through server actions colocated with the page that triggers them.

## 10. UI structure

```
app/
  (auth)/
    login/
    accept-invite/
  (admin)/
    dashboard/
    events/
      page.tsx                 # list
      new/
      past/
      [id]/
        page.tsx               # overview
        edit/
        entries/
        prizes/
        packages/
        draw/                  # admin draw control
        presentation/          # projection mirror
        tablet-capture/
        public/                # publish settings
        winners/
        leaderboard/
    entrants/
      page.tsx
      [id]/
    settings/
      organisation/
      users/
  (public)/
    p/
      [slug]/
        page.tsx
        enter/
  api/
    ...
  components/
    ui/                        # buttons, inputs, dialogs (shadcn-style)
    draw/                      # SlotMachine, ReelStrip, WinnerCard
    forms/                     # EventForm split into smaller pieces
    public/                    # PublicHero, PrizeGrid, EntryForm
    layout/                    # AdminShell, PublicShell, ThemeProvider
  lib/
    auth.ts                    # better-auth instance
    db.ts                      # prisma client
    rng.ts                     # crypto.randomInt helpers
    storage.ts                 # local | s3 driver
    email.ts                   # NodeMailer + templates
    theme.ts                   # getActiveTheme, CSS var emission
  server/
    actions/
    rbac.ts                    # requireRole, requireUser
```

## 11. Deployment

- **Container**: single Dockerfile, multi-stage. Output is a minimal Node 20 image running `next start`.
- **Required env**:
  - `DATABASE_URL`
  - `BETTER_AUTH_SECRET`
  - `BETTER_AUTH_URL` (canonical app URL)
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  - `STORAGE_DRIVER` = `local` | `s3`
  - `STORAGE_LOCAL_PATH` (if local) — mounted volume
  - `S3_*` (if s3)
  - `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD` (one-time, for initial superadmin)
- **DB migrations**: `prisma migrate deploy` runs on container start
- **Health check**: `GET /api/health` returns 200 if DB reachable
- **Logging**: structured JSON to stdout; devops to handle aggregation
- **Backups**: out of scope for the app; devops handles Postgres backups

## 12. Migration from v1

We have v1 data we want to keep (entrants and history). Approach:

1. Stand up a v2 instance against an empty DB
2. Write a one-off `pnpm migrate:from-v1` script that connects to both DBs and copies:
   - Entrants → Entrant (1:1)
   - Events → Event (1:1, defaulting org to the single seeded org)
   - Entries → Entry (regenerate `ticketNumber` deterministically from `createdAt` order per event)
   - Prizes → Prize (preserve `winningEntryId` mapping; set `lockedAt = drawnAt` if event was drawn)
   - EntryPackages → EntryPackage
3. Existing `entrants_import.sql` files are now legacy; keep them in v1 repo only.
4. Admin users do **not** migrate; create fresh in v2 (their passwords were a mix of Supabase and bcrypt).

## 13. Build phases

We build this together; each phase is a checkpoint where the app is usable.

### Phase 0 — Foundations (1 sitting)
- Repo setup, Next 15 + TS + Tailwind, Prisma, Postgres docker-compose for local dev
- Schema + first migration
- better-auth wired up, login + bootstrap superadmin
- Empty admin shell with role gating

### Phase 1 — Events & entrants core
- Organisation settings page
- Event CRUD (basics + prizes + packages tabs)
- Entrant list + search + edit
- Admin entry form (with package selection)
- Lifecycle transitions (open/close)

### Phase 2 — The draw
- crypto-RNG selection endpoint
- Slot-machine component (split DrawAnimation into <SlotMachine>, <ReelStrip>, <WinnerCard>)
- Admin draw page
- Lock / redraw / clear-winner
- **Test draw mode** (rehearsal — no persistence)
- Presentation mode + SSE stream (with reconnect/resync for flaky wifi)
- Sounds + confetti

### Phase 3 — Tablet capture
- Tablet route, simplified flow
- Payment-handover step
- Idle auto-logout

### Phase 4 — Email
- NodeMailer + EmailLog
- Winner-notification template
- Entry-confirmation template
- Retry UI

### Phase 5 — Public portal
- Tiptap editor in event edit
- File upload + image rendering (local-disk driver, S3 driver behind same interface)
- Public page (`/p/[slug]`) with theming
- Public entry form with rate limit
- Reconciliation page for unpaid public entries

### Phase 6 — Themability + polish
- Theme tokens + colour pickers
- Dark mode pass with proper semantic tokens
- Leaderboard page
- Past events page
- v1 → v2 data migration script

### Phase 7 — Hardening
- Server-side pagination on all lists
- Error boundaries + toast system
- Form validation messages
- **Audit log sweep** — confirm `logAudit` calls cover every action enum value; build the audit-log page
- Health check + structured logs
- Dockerfile + docs handoff to devops

## 14. Decisions log

Initial open questions from the first draft of this spec, now resolved:

1. **Payment reconciliation for public entries** — manual. Public entries land with `paidAt = null`; admin reconciles via the reconciliation page (8.6).
2. **Test draw / dry-run mode** — included. See 8.7 "Test draw mode".
3. **SMS opt-in field** — collected on Entrant now (`smsOptIn`) even though SMS sending is deferred.
4. **Admin audit trail** — included. `AuditLog` model (6) + audit-log page (8.11) + cross-cutting `logAudit` helper.
5. **Storage** — local disk to start, with the storage driver interface designed so swapping in S3 later is a config change, not a refactor.
