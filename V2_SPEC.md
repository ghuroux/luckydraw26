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
| i18n / formatting| `Intl.*` + `date-fns-tz`        | Org-configurable currency, locale, timezone via `lib/format.ts`     |
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
  bgPattern     String?  // public-portal only — subtle repeating background image
  contactEmail  String?
  // Toggleable in Org settings. All currency + date display routes through
  // lib/format.ts using these.
  currencyCode  String   @default("ZAR")             // ISO 4217 (e.g. ZAR, USD, EUR, GBP)
  locale        String   @default("en-ZA")           // BCP 47; drives number/currency formatting
  timezone      String   @default("Africa/Johannesburg")  // IANA tz identifier
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
  deletedAt      DateTime?  // POPIA right-to-be-forgotten: when set, name/email/phone are anonymised but entries + audit rows remain intact (see §8.5)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  entries        Entry[]
  @@index([lastName, firstName])
  @@index([createdAt])
  @@index([deletedAt])
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
  isPublished           Boolean    @default(false)
  publishedSlug         String?    @unique
  publicDescription     Json?      // Tiptap JSON — editor source of truth
  publicDescriptionHtml String?    // Denormalised rendered HTML. Written on save via @tiptap/html; public page renders this directly so its bundle ships zero Tiptap.
  publicHeroImage       String?    // Storage key, resolved through the storage driver
  themeOverride         Json?      // Shape: { primaryColor?: string; accentColor?: string } — 6-digit hex strings, validated by the same regex as Organisation

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
  ticketNumber    Int           // sequential per event; preserved even when voided (no renumbering)
  packageId       String?
  packageEntryNum Int?          // position within the package (1..quantity)
  donationAmount  Decimal?       @db.Decimal(10, 2)
  paymentRef      String?        // free-text reference (card slip number, EFT ref, operator notes); optional even when paid
  paymentMethod   PaymentMethod? // captured at the tablet flow; null on PUBLIC entries and on unreconciled admin entries
  paidAt          DateTime?      // null = unreconciled (typically PUBLIC source); always set on TABLET (operator picks CASH/CARD before submit)
  voidedAt        DateTime?      // soft-delete: voided entries are excluded from draws but kept for audit
  voidReason      String?        // free-text, captured at void time
  source          EntrySource    @default(ADMIN)
  createdAt       DateTime       @default(now())

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

enum PaymentMethod {
  CASH
  CARD
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

// Sliding-window rate limit for public entry submissions. IP is hashed with
// HMAC-SHA256(env: RATE_LIMIT_SALT) so we don't store raw addresses (POPIA-
// friendly). Rows older than 24h are pruned on each insert (cheap; no cron).
model PublicEntryRateLimit {
  id            String   @id @default(cuid())
  ipHash        String
  slug          String
  createdAt     DateTime @default(now())

  @@index([ipHash, slug, createdAt])
  @@index([createdAt])
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
  PACKAGE_CREATED
  PACKAGE_UPDATED
  PACKAGE_DELETED
  WINNER_LOCKED
  WINNER_CLEARED
  WINNER_NOTIFIED
  ENTRY_CREATED
  ENTRY_DELETED        // hard delete; rare, for pre-launch test cleanup
  ENTRY_VOIDED         // soft delete (sets voidedAt); the operational path post-launch
  ENTRY_UNVOIDED       // restore a previously voided entry
  ENTRY_RECONCILED     // paidAt set
  ENTRANT_UPDATED
  ENTRANT_DELETED      // POPIA anonymisation (soft); see §8.5
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
- `Entry.voidedAt` / `voidReason` enable soft-delete via reconciliation; voided entries are excluded from draws but preserved for audit (and ticket numbers are not reused)
- `Event.publicDescriptionHtml` denormalises Tiptap-rendered HTML so the public page ships no Tiptap deps
- `PublicEntryRateLimit` table backs the public-portal submit limiter (hashed IP, sliding window, self-pruning)
- `Organisation.currencyCode` / `locale` / `timezone` make currency + date display org-configurable (defaults `ZAR` / `en-ZA` / `Africa/Johannesburg`); composed via `Intl.NumberFormat` and `date-fns-tz` in `lib/format.ts`
- `Entrant.deletedAt` enables POPIA right-to-be-forgotten via anonymisation rather than hard delete (preserves audit trail and historical entry-to-prize relations)
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
- Optional repeating background pattern image (public portal only)
- **Localisation**:
  - `currencyCode` dropdown (common: ZAR, USD, EUR, GBP, NAD, BWP) — affects every money display in admin + public via `formatCurrency()`
  - `locale` dropdown (common: en-ZA, en-US, en-GB, de-DE) — affects number / date formatting
  - `timezone` dropdown (common SA-friendly: Africa/Johannesburg, UTC, Europe/London) plus a typeahead for any IANA tz — affects every datetime display via `formatDate()` / `formatDateTime()`
  - Defaults: ZAR / en-ZA / Africa/Johannesburg
- "View public portal preview" link

### 8.3 User management (`/settings/users`) — SUPERADMIN
- List users with role badges
- Invite user (email + role) — sends temporary-password email
- Change role, deactivate user, force password reset

### 8.4 Events
**List (`/events`)**: filter by status (Draft / Open / Closed / Drawn), search by name, server-paginated. Defaults to non-DRAWN events; "All" filter shows DRAWN too.

**Past events (`/events/past`)**: archive of all `DRAWN` events (no time threshold — clean separation of "active" vs. "history"). Sortable by drawnAt.

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
- **Delete (POPIA right-to-be-forgotten)** — ADMIN action on entrant profile:
  - Anonymises rather than hard-deletes (preserves historical entry-to-prize relations and audit-log integrity, both of which the regulations actually allow under "legitimate interest" for compliance evidence)
  - Sets `deletedAt = now()`, replaces `firstName` with "[deleted]", `lastName` with the entrant's `id` slug (so duplicates don't break the firstName index), `email` with `deleted-<id>@example.invalid` (preserves email-uniqueness without leaking the original), nulls `phone` and `dateOfBirth`
  - Hidden from `/entrants` list and search; cannot be picked in entry-creation typeahead; excluded from draw eligibility
  - Existing entries retain their ticket numbers and audit log entries (linked via the now-anonymised entrant)
  - Audit-logged `ENTRANT_DELETED` with the *un*-anonymised name in the metadata (the audit log is the legitimate record of who erased what; restricted to SUPERADMIN view)
  - Confirmation dialog requires typing the entrant's email to proceed

### 8.6 Entries
**Add (admin form, `/events/[id]` entry tab)**:
- Search-as-you-type entrant by name/email/phone
- If found, select; if not, "Create new entrant" inline (with sponsor-share + SMS opt-in checkboxes)
- Choose a package, individual entries, or both (combos use the package's prorated per-ticket rate for extras — see tablet Step 3)
- Optional donation amount
- Optional payment reference (sets `paidAt` if provided)
- On submit, server allocates `ticketNumber = max + 1` for that event in a transaction
- v1 bug to avoid: do **not** auto-fill email when selecting an existing entrant

**Tablet capture (`/events/[id]/tablet-capture`)**:

Fullscreen, simplified UI tuned for iPad portrait. Touch-friendly (large tap targets, minimal typing where possible). Available to STAFF; no role gate beyond auth.

Five-step flow:

- **Step 1 — Landing**: persistent home screen the seller returns to between captures. Shows event name, prize summary (top 3 prizes with thumbnails when images are wired in Phase 5), entry pricing (single + active packages), live total entries sold. Single big CTA: "Sell ticket".
- **Step 2 — Entrant details**: a single touch-friendly search field at the top, debounced against `searchEntrants` (matches name + email + phone). Results render below as tappable cards showing **full name + email** (and phone when present). The seller asks the customer for their name; common case is one tap to select. Tapping a card shows the **"Welcome back, {firstName}"** card with their details pre-filled and locked (Change button returns to the search). A persistent "Add as new entrant" tile beneath the results reveals an inline new-entrant form (first name, last name, email, phone, sponsor-share + SMS opt-ins). The pure-email autocomplete used in v1 was abandoned here because customers volunteer their name first, not their email.
- **Step 3 — Selection**: package + individual entries are independent and combinable. Tap a package card to select it (or none), and use the always-live stepper to add N single tickets. When a package is selected, *extra* individual tickets price at the **package's prorated per-ticket rate** (`pkg.cost / pkg.quantity`) — e.g. a "1000 for R2000" package puts extras at R2 each, not the event's regular `entryCost`. Without a package, individuals price at `entryCost` as before. All entries — package + extras — are persisted (each gets its own ticket number) so they all participate in the draw. Live running total displayed at the bottom of the screen.
- **Step 4 — Payment handover**: shows amount due + a discrete **CASH / CARD** chooser (operator must pick one before Confirm enables) + an optional payment reference input (card slip number, etc.). Copy: "Hand the device to the customer for payment, then capture the method." On submit, `paymentMethod` is stored on every created Entry, `paidAt = now()` regardless of whether a reference was provided. The earlier "default blank ref to `CASH`" rule is superseded by the explicit method picker.
- **Step 5 — Confirmation**: shows the assigned ticket numbers ("Tickets #18–#22 for Jane Doe"), the running event-day total, and two CTAs: "Capture another entry" (returns to Step 1) and "Done" (returns to Step 1 after a 5-second auto-advance).

On submit, `paidAt` is set to `now()` and `source = TABLET`. Entries appear immediately in the admin entries list and the entrant's profile (revalidatePath fires on those routes).

**Idle auto-logout**: configurable via the `TABLET_IDLE_LOGOUT_MINUTES` env var, default `15`. After idle timeout the tablet returns to the login screen (NOT the landing) so an unattended device can't keep capturing.

**Reconciliation (`/events/[id]/reconciliation`)** — ADMIN:
- Lists entries with `paidAt = null AND voidedAt = null` (typically `source = PUBLIC`)
- Shows entrant, ticket numbers, amount owed, submitted-at, payment ref input inline
- "Mark paid" sets `paidAt = now()` and stores the ref; bulk-select supported (audit-logged `ENTRY_RECONCILED`)
- "Void entry" is a **soft-delete**: sets `voidedAt = now()` and prompts for `voidReason` (free-text). Voided entries:
  - Are excluded from the draw eligibility filter
  - Keep their `ticketNumber` (no renumbering — preserves audit clarity)
  - Are visible in a separate "Voided" tab on this page with an "Unvoid" action
  - Audit-logged `ENTRY_VOIDED` / `ENTRY_UNVOIDED` with the reason in metadata
- Counter at top: outstanding count + outstanding amount

### 8.7 Draw experience

**Admin draw (`/events/[id]/draw`)** — for the operator:
- Lists prizes with current status (no winner / winner / locked)
- "Start draw for [Prize Name]" button per un-won prize
- Triggers the reveal animation client-side, fed by a server-picked winner + name pool
- After the reveal: shows the winner card with "Lock in winner" + "Redraw" buttons
- "Lock in winner" sets `Prize.lockedAt`, disables further redraws for that prize
- "Redraw" picks a new winner (only if not locked)
- "Send winner email" button — **Phase 2 ships as no-op stub** with a "coming in Phase 4" toast; Phase 4 wires it to NodeMailer + the EmailLog outbox

#### Selection algorithm

- RNG: `crypto.randomInt(0, eligibleEntries.length)` (cryptographically strong — fixes v1's `Math.random` weakness)
- Eligible pool = entries whose **entrant has not already won a prize at this event** (one-win-per-entrant rule)
- Selection is weighted by entry count automatically — entrants with more tickets appear more times in the eligible list
- **Pool exhaustion fallback**: if no eligible entries remain (e.g. 5 prizes but only 4 unique entrants), the eligibility filter resets — the next draw runs against the full entries list as if it were the first prize. An entrant can win more than once when this happens. The UI shows an explanatory note ("All entrants have already won — eligibility reset for this prize") and the audit log records it.

#### The reveal animation (reimagined for v2)

We're **not** rebuilding v1's three-column arcade slot machine. The v2 reveal is a single elegant column tuned for the premium prize-giving moment of a high-end charity gala. Visual brief:

- **Layout**: full-bleed dark surface, single centred column ~60% of viewport height, taking up the full width responsively (and 16:9 in presentation mode). Generous breathing room.
- **Type**: large semi-bold display type (Geist or a complementary display face), high contrast against the surface, names rendered legibly throughout — no blur until the very fast portion.
- **Pool**: server returns the winning entry ID **plus a pool of 10 real entrant names** (the winner is one of the 10; the other 9 are randomly sampled from the rest of the event's entrants). When the event has fewer than 10 unique entrants, the pool repeats — never falls below 10 frames so the animation feels full.
- **Sequence** (~7.5 seconds total — settled on these timings after live iteration):
  1. **Spin-up** (~2s, 8% of distance, `easeInQuad`) — names accelerate from near-stationary to peak speed; the deliberately slow start builds suspense and lets the audience read 5–7 names before the blur
  2. **Race** (~3.5s, 86% of distance, linear) — names blur slightly (3px) as they fly past at peak speed; ambient rhythmic ticks per pass
  3. **Slow-down** (~1.5s, 5% of distance, `easeOutCubic`) — exponential deceleration; blur drops to 1px then off; names regain legibility
  4. **Land** (~0.5s, 1% of distance, `easeOutBack`) — final settling onto the winner with a satisfying chime and a subtle bounce
  5. **Reveal** — winner card cross-fades in below: full name, ticket number, prize name; confetti burst from the card edges
- **Reduced-motion**: respect `prefers-reduced-motion` — replace the scroll with a 3-second cross-fade through the 10 names ending on the winner; no blur, no scale.
- **Components**: split into `<DrawStage>` (orchestration), `<NameReel>` (the scrolling column), `<WinnerCard>` (the reveal), `<ConfettiLayer>` (canvas-confetti). Each ≤200 lines.

#### Sound design

The reveal needs to feel *expensive* — not arcade. Premium royalty-free sound effects from a curated library. v1's `_v1/public/sounds/` files were too "Vegas" and mostly placeholder anyway — replaced wholesale.

Required sounds:
- `spin-loop.mp3` — looped ambient tick during race, ~0.5s loop
- `slowdown.mp3` — descending sweep for the slow-down phase
- `land.mp3` — single satisfying chime on landing (warm bell, not coin-clatter)
- `winner.mp3` — celebratory swell for the reveal (~2s, building, sparkles)

Current files were sourced from [SoundBible.com](https://soundbible.com) via direct curl of `grab.php` endpoints (Pixabay/Mixkit blocked WebFetch with bot protection). Most SoundBible sounds are **CC Attribution 3.0** — Phase 5's public portal needs a SoundBible credit somewhere visible. See `public/sounds/LICENSES.md` for per-file provenance and 8 alternates in `_alternates/` for swapping if a pick lands wrong.

Audio respects an in-app mute toggle (persisted in localStorage `luckydraw.muted`) and the OS-level mute (Howler honours it via the AudioContext). Howler.js handles the playback.

#### Presentation mode (`/events/[id]/presentation`) — for projection

- Clean, full-bleed UI sized for projection (16:9, large type, themed with the org/event palette)
- Mirrors the admin draw via SSE — when the operator clicks "Start draw" on the admin page, the presentation screen runs the same animation in sync
- Confetti + winner sound on lock-in (also via SSE)
- No interactive controls; read-only
- Recovers gracefully from a dropped connection: on reconnect, fetches current state from a snapshot endpoint and skips any animation in progress (don't re-spin a draw the audience already saw)

#### SSE channel (`/api/events/[id]/stream`)

- Events: `draw_started`, `draw_winner_revealed`, `winner_locked`, `winner_cleared`, `prize_updated`, plus `draw_test_started` / `draw_test_winner_revealed` for the test mode (separate event names so a rehearsal can never be confused for the real thing)
- **Auth pattern**: validation happens *inside the route handler*, not at the edge middleware (Prisma can't run on the edge). The route handler:
  1. Calls `auth.api.getSession({ headers })` (server-side better-auth lookup)
  2. If no session or role < STAFF, returns `401` immediately and closes the stream
  3. Otherwise pipes events from an in-memory `EventEmitter` (one per event-id, server-singleton) into a `ReadableStream` formatted per the SSE protocol
- Last-event-id reconnect supported (simple in-memory ring buffer of the last ~50 events per event-id; clients send `Last-Event-ID` header on reconnect)
- Heartbeat: send a `:keepalive` comment every 25s so proxies don't time out the stream

**Concurrency / lock-in race**: two admins clicking "Lock in winner" at the same prize at the same moment is prevented by `Prize.winningEntryId @unique`: the second update fails with a unique-constraint error, surfaced as "This prize was just locked by another admin" to the slower one. We don't need optimistic locking beyond this.

#### Redraw / clear winner

- **`clearWinner(prizeId)` server action** (in `lib/actions/draw.ts`, not a separate REST route — Phase 2 conventionalised mutations as server actions); ADMIN only
- Only proceeds if `lockedAt is not null` — i.e. unlocks an already-locked prize back to draw-able state. Returns `{ ok: false, error: "This prize is not locked in." }` if the prize was never locked. (The earlier spec text said "only if lockedAt is null" — that was internally inconsistent: pre-lock there's nothing to clear.)
- Sets `winningEntryId = null` and `lockedAt = null` atomically via `updateMany` with a `lockedAt: { not: null }` guard
- Audit-logged as `WINNER_CLEARED`
- Triggers an SSE `winner_cleared` event so presentation mode drops back to idle for that prize

#### Test draw mode (rehearsal before going live)

- "Test draw" button next to "Start draw"; only available when event is `OPEN` or `CLOSED` and prize has no winner
- Picks a winner using the live algorithm but **does not persist** — no `winningEntryId`, no `lockedAt`, no email
- UI is decorated with a "TEST" watermark; presentation mode shows the same watermark so the audience isn't misled if it's accidentally shown
- Logged as `PRIZE_TEST_DRAWN` in the audit log
- Lets the MC rehearse the entire reveal end-to-end with the projector wired up

### 8.8 Public event portal

This is the v1-speced-but-unbuilt feature.

#### Storage driver (`lib/storage.ts`)

Image uploads land in Phase 5 — logo (`Organisation.logoUrl`), event hero (`Event.publicHeroImage`), prize images (`Prize.imageUrl`). All flow through one driver interface so production can flip from local disk to S3 with an env change, no refactor.

```ts
interface StorageDriver {
  upload(input: {
    key: string;        // e.g. "events/<eventId>/hero-<timestamp>.png"
    data: Buffer;
    contentType: string;
  }): Promise<{ url: string }>;
  url(key: string): string;        // public URL for a stored key
  delete(key: string): Promise<void>;
}
```

Two implementations:
- **`LocalDriver`**: writes under `STORAGE_LOCAL_PATH`; reads served via `/api/storage/[...path]/route.ts` (streams the file with the right content-type, cache headers). Devops should mount this path as a volume.
- **`S3Driver`**: `@aws-sdk/client-s3`; `url()` returns the bucket's public URL. Bucket must be configured for public read on the served prefix.

Driver picked at module load via `STORAGE_DRIVER=local|s3`. Key naming convention: `<entity>/<entityId>/<purpose>-<timestamp>.<ext>` — predictable, sortable, prefix-friendly for S3 lifecycle rules later.

Upload UI uses a single small `<ImageField>` component (Phase 5 build) that handles file picker + client-side validation (max 5MB, jpg/png/webp) + progress.

#### Publishing (event edit, *Public portal* tab)

- **Toggle `isPublished`**: when off, `/p/[slug]` returns 404
- **Slug**:
  - Auto-suggested via slugify(event.name) → e.g. "October Charity Golf Day" → `october-charity-golf-day`
  - As the operator types, debounced server check pings a `checkSlugAvailable` server action; UI shows a green "Available" or red "Taken — try `october-charity-golf-day-2026`" with a one-click apply
  - Suggested fallback variations: append `-<year>`, then `-2`, `-3`, etc. until free
  - On submit, server re-validates inside the transaction; surfaces a friendly retry message if a race made it taken in the interim
- **Rich-text description**: Tiptap editor with starter kit (headings H1-H3, bold/italic, links, lists) plus image extension. Images uploaded inline via the storage driver; the editor inserts the resolved URL.
- **Tiptap rendering**: the same extension list lives in `lib/tiptap-extensions.ts`, imported by both editor (client) and `@tiptap/html`'s `generateHTML(json, extensions)` on the server. On save, the action renders once and stores the HTML to `Event.publicDescriptionHtml`. The public page renders the HTML directly — public bundle ships zero Tiptap.
- **Hero image upload**: `<ImageField>` writes via the storage driver, sets `publicHeroImage` to the storage key
- **Per-event theme override**: optional primary/accent colour pickers (same component as org settings); writes `themeOverride: { primaryColor?, accentColor? }`. When unset, public layout uses the org theme.
- **Preview**: button opens `/p/[slug]?preview=<signed-token>` in a new tab. Token signed with `BETTER_AUTH_SECRET`, includes `eventId` + 1h expiry; viewing in preview mode bypasses the `isPublished` check but watermarks the page with "PREVIEW".

#### Public page (`/p/[slug]`) — unauthenticated

- Themed layout: org `bgPattern` if set (subtle repeating background image, public portal only — admin UI stays clean), org logo, primary/accent colours overridden by `Event.themeOverride` when present
- Renders `publicDescriptionHtml` directly, prizes (image + name + description, in `order`), entry pricing (single cost + active packages)
- Entry CTA → `/p/[slug]/enter`
- Read-only after event closes (`status === CLOSED` or `DRAWN`): hide entry CTA, show "Entries closed" notice; for `DRAWN`, append a "Winners" section listing winning entrant names + their prize (only after `lockedAt` is set on the prize)
- ISR with `revalidate: 60` for unauthenticated visits; explicit `revalidatePath('/p/<slug>')` in any server action that mutates an event the slug points to (lifecycle, prize edits, theme changes, content saves)

#### Public entry form (`/p/[slug]/enter`)

- Collects entrant details (matches Entrant schema)
- Choose package or N individual entries
- Sponsor-share opt-in + SMS opt-in checkboxes (each with a short, plain-English explanation alongside)
- **Bot defenses**:
  - Honeypot field (`name="company"`, hidden via CSS, server rejects if non-empty)
  - DB-backed rate limit via `PublicEntryRateLimit`: max 10 submissions per IP per slug per rolling hour. IP is hashed (`HMAC-SHA256(ip, RATE_LIMIT_SALT)` from env) before storing — no raw addresses retained. Each insert prunes rows older than 24h.
  - On rate-limit hit: HTTP 429 with friendly message "You've submitted a lot of entries recently — please try again later or contact the event organisers."
- No payment integration: submission creates entries with `source = PUBLIC`, `paymentRef = null`, `paidAt = null`. Admin reconciles via the reconciliation page (8.6).
- Confirmation page with ticket numbers + email confirmation (Phase 4 hookup), with a clear note that payment is settled separately

### 8.9 Email notifications

**Templating**: [React Email](https://react.email) — components written in TSX, compiled to MJML-quality HTML, dev-server preview built in. Lives under `lib/email/templates/`.

Templates:
- `entry-confirmation` — sent on public entry submission (Phase 5)
- `winner-notification` — sent when `Prize.lockedAt` is set, or manually re-triggered from the draw page
- `user-invitation` — sent by SUPERADMIN invite flow (Phase 7-ish)
- `password-reset` — better-auth's flow; we override the template render to keep brand consistency

All templates render with the active org's logo + primary colour for brand consistency. The render call passes `{ organisation, ...templateContext }` so each template can pull `org.name`, `org.logoUrl`, `org.primaryColor`, `org.contactEmail`.

**Provider**: SendGrid via SMTP (NodeMailer talks to it through the existing `SMTP_*` env vars — no SDK lock-in). Devops env will be:

```
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"            # literal string per SendGrid SMTP docs
SMTP_PASS="<sendgrid-api-key>"
SMTP_FROM="noreply@<verified-domain>"
```

SendGrid requires sender authentication (SPF/DKIM on the sending domain). Devops territory; flagged here for the runbook.

**From / Reply-To**:
- `From: SMTP_FROM` — the verified sender, fixed per environment
- `Reply-To: Organisation.contactEmail || SMTP_FROM` — so replies route to the org's contact (set per Organisation), falling back to the From if unset

**EmailLog** (data model §6) records every send attempt:
- `sentAt = null` until the SMTP call resolves successfully
- `error` populated on failure (truncated to 500 chars to avoid log bloat from full SMTP traces)
- Phase 4 may add `attempts` (Int) and `lastAttemptAt` (DateTime) fields when we wire retry — confirm at start of phase

**Email log UI** (`/settings/email-log`) — SUPERADMIN, separate from the audit log:
- Reverse-chronological list with filters (template, status: queued/sent/failed, date range)
- Each row: to, subject, template, status badge, sentAt or error preview
- Click row → drawer with full context payload (the JSON passed to the template), full error trace, and a "Retry" button (re-runs the send)
- "Resend" available even on successful sends (operator override)

**Cross-link with audit log**: when the audit log shows `WINNER_NOTIFIED` (or any `*_NOTIFIED`-style action), the row deep-links to the corresponding email-log entry via metadata `{ emailLogId }`.

### 8.10 Leaderboard (`/events/[id]/leaderboard`)

Per-event ranking, paginated. Two views from one query.

**Admin view** (signed-in):
- Rank
- Entrant name (full) — linked to `/entrants/[id]`
- Entries count (the primary weight in draws)
- Total contributed: sum of (individual entries × entryCost) + (package costs) + donations, formatted via `formatCurrency()` against the org's currencyCode/locale
- Joined at (timestamp of their first entry on this event)
- "Won" badge if they've won at least one prize at this event

**Public view** (`/p/[slug]/leaderboard`, only when event isPublished):
- Same columns except entrant name is shown as **"FirstName L."** (last initial only) for privacy — POPIA-friendly default
- Total contributed shown as the same currency display
- Excludes voided + deleted entrants

Both views excluded if `Event.entries.length === 0`. Sorting: entries count desc, then total contributed desc, then joined-at asc as tiebreakers.

### 8.11 Audit log (`/settings/audit-log`) — SUPERADMIN

- Reverse-chronological feed of `AuditLog` entries
- Filters: actor (user), action, entity type, date range
- Click an entry to see metadata payload (before/after diff for updates)
- Backed by a `logAudit({ action, entityType, entityId, metadata })` helper called from server actions and key API routes
- Helper grabs the current user from the session automatically; system-triggered actions pass `userId = null`
- Cross-cutting concern — wired in throughout, with a Phase 7 sweep to ensure coverage

### 8.12 Theming
- Tailwind CSS variables (`--primary`, `--accent`, etc.) declared in `app/globals.css` and exposed to Tailwind via `@theme inline`. Org/event theme overrides cascade in via inline `style={{ '--primary': ... }}` on the route-group layout (admin: `app/(admin)/layout.tsx`; public: `app/(public)/p/[slug]/layout.tsx`).
- **Dark mode**: `class` strategy with three-state toggle (System / Light / Dark) in the user-menu dropdown (top-right of admin header):
  - "System" (default) follows `prefers-color-scheme`
  - "Light" / "Dark" force the corresponding mode
  - Choice persisted in `localStorage` under `theme` key
  - SSR injects an inline `<script>` in `<head>` (or `next-themes` lib equivalent) to set the right class before paint, preventing flash-of-unstyled-content
- Form inputs and surfaces use semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.) — no raw colours — so dark mode "just works" everywhere.
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
  - `RATE_LIMIT_SALT` (HMAC salt for hashing public entrants' IPs in rate-limit storage)
  - `TABLET_IDLE_LOGOUT_MINUTES` (default 15)
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
- `lib/rng.ts` — crypto-based selection helpers (replaces v1's `Math.random`)
- `lib/sse.ts` — SSE encoder + per-event in-memory pub/sub with last-event-id buffer
- Selection endpoint with pool-of-10 + pool-exhaustion fallback (eligibility resets)
- Reveal animation: `<DrawStage>` / `<NameReel>` / `<WinnerCard>` / `<ConfettiLayer>` (single elegant column, premium typographic feel — *not* v1's three-column arcade)
- Sound design pass: source 4 premium royalty-free SFX (spin-loop, slowdown, land, winner) + Howler.js wiring + mute toggle persisted in localStorage
- `respect prefers-reduced-motion` — fallback cross-fade reveal (no scroll, no blur)
- Admin draw page (`/events/[id]/draw`) — operator UI, per-prize Start/Test buttons
- Lock / redraw / clear-winner with `Prize.winningEntryId @unique` race protection
- **Test draw mode** (rehearsal — no persistence, separate SSE event names)
- Presentation mode (`/events/[id]/presentation`) — full-bleed mirror via SSE, snapshot recovery on reconnect
- "Send winner email" button stub (no-op + "coming in Phase 4" toast)

### Phase 3 — Tablet capture ✅
- `/events/[id]/tablet-capture` route — touch-friendly, full-bleed (lives outside the `(admin)` route group; URL unchanged)
- Five-step flow: Landing → Entrant (search by name/email/phone) → Selection (package + extras combinable, prorated rate) → Payment handover (CASH/CARD) → Confirmation (auto-back-to-landing in 5s)
- Payment method captured discretely as `Entry.paymentMethod` (`CASH | CARD` enum); `source = TABLET` forces `paidAt = now()`
- Idle auto-logout via `TABLET_IDLE_LOGOUT_MINUTES` env var (default 15, fractional allowed, 0 disables) — calls `authClient.signOut()` then redirects to `/login`

### Phase 4 — Email
- `lib/email.ts` — NodeMailer + SendGrid SMTP wrapper, EmailLog write-on-attempt
- React Email setup (`lib/email/templates/`) with org-themed shell component
- Templates: `winner-notification`, `entry-confirmation` (the Phase 5 hookup)
- `/settings/email-log` SUPERADMIN page — list + filters + drawer + Retry/Resend
- Replace the Phase 2 "Send winner email" no-op stub with the real call
- Audit-log cross-link: `WINNER_NOTIFIED` audit rows store `{ emailLogId }` in metadata
- Possible schema add: `EmailLog.attempts`, `EmailLog.lastAttemptAt` (decide at start of phase)

### Phase 5 — Public portal + reconciliation
- `lib/storage.ts` — driver interface + LocalDriver + S3Driver, picked via `STORAGE_DRIVER`
- `/api/storage/[...path]` route handler for serving local-disk uploads
- Migration: add `Event.publicDescriptionHtml`, `Entry.voidedAt`, `Entry.voidReason`, `PublicEntryRateLimit` table, `ENTRY_VOIDED`/`ENTRY_UNVOIDED` audit actions, `RATE_LIMIT_SALT` env var
- `lib/tiptap-extensions.ts` — shared extension list for editor + `@tiptap/html` server render
- Event edit *Public portal* tab: slug with live-availability check, Tiptap rich text editor with image upload, hero image, per-event theme override, Preview (signed-token URL)
- `<ImageField>` component (used here + retrofitted into prize/org settings)
- `/p/[slug]` public page (themed, ISR, hides entries when closed, shows winners when drawn)
- `/p/[slug]/enter` public entry form (honeypot + DB-backed sliding-window rate limit, hashed IP)
- `/events/[id]/reconciliation` ADMIN page — Outstanding tab + Voided tab, mark-paid (bulk) + soft-void with reason

### Phase 6 — Themability + polish
- Migration: add `Organisation.currencyCode`, `locale`, `timezone`, `Entrant.deletedAt`, `ENTRANT_DELETED` audit action
- `lib/format.ts` — `formatCurrency(value, org)`, `formatDate(date, org)`, `formatDateTime(date, org)`, `formatTime(date, org)` using `Intl.NumberFormat` + `date-fns-tz`. Replace every inline `new Date(...).toLocaleDateString()` and raw `${event.entryCost}` site-wide.
- Org settings: currency / locale / timezone dropdowns; live preview of "R 1 234,56" / "26 April 2026, 12:30" so SUPERADMIN can see the choice
- `next-themes` (or hand-rolled equivalent) — three-state System/Light/Dark toggle in the user-menu dropdown
- Dark-mode sweep: audit every page for hardcoded text colours, ensure all surfaces use semantic tokens
- `/events/[id]/leaderboard` (admin) + `/p/[slug]/leaderboard` (public, first-initial format)
- `/events/past` archive page (status === DRAWN, no time threshold)
- Entrant POPIA delete action with email-confirmation dialog + anonymisation server action
- v1 → v2 data migration script (carries over entrants + events + entries from `_v1/` Postgres dump)

### Phase 7 — Hardening (ship-ready gate)
- **Audit log sweep** — confirm every `AuditAction` enum value has at least one `logAudit()` caller; build `/settings/audit-log` page (filters: actor, action, entity type, date range; row drawer with metadata diff)
- **Toast system** — sonner + tasteful defaults; replace the `setTimeout`-driven "Saved at X" patterns from Phase 1
- **Loading + error UIs** — `loading.tsx` per route segment, `error.tsx` for graceful crashes, custom `not-found.tsx`, `global-error.tsx`
- **Health check** — `GET /api/health` returns 200 + DB latency probe; documented for devops load balancer
- **Structured logger** (`lib/logger.ts`) — JSON output to stdout; replace scattered `console.error` in audit + email; redact `paymentRef` and personal fields
- **Session cleanup** — daily prune of expired better-auth sessions (cron in production via devops, or on-login cleanup in app)
- **Performance audit** — sweep server actions for N+1 queries, confirm covering indexes exist for hot paths (`Entry [eventId, ticketNumber]`, `AuditLog [createdAt]`, `Entrant [lastName, firstName]`), measure p95 of admin draw page with a populated DB
- **Security pass** — review every `db.$queryRaw` / `db.$executeRaw` (currently zero, but lock that in), confirm Tiptap renders sanitise input, verify CSRF + cookie security via better-auth defaults, confirm `RoleGate` covered by server-side `requireRole()` everywhere
- **CI / DX**: `.github/workflows/ci.yml` (typecheck + lint + build), ESLint + Prettier config, `.nvmrc`, README rewrite for devops + contributors
- **Dockerfile + production runbook** — multi-stage Dockerfile, runbook covering env vars, health check, log aggregation, backup + restore basics

## 14. Decisions log

Initial open questions from the first draft of this spec, now resolved:

1. **Payment reconciliation for public entries** — manual. Public entries land with `paidAt = null`; admin reconciles via the reconciliation page (8.6).
2. **Test draw / dry-run mode** — included. See 8.7 "Test draw mode".
3. **SMS opt-in field** — collected on Entrant now (`smsOptIn`) even though SMS sending is deferred.
4. **Admin audit trail** — included. `AuditLog` model (6) + audit-log page (8.11) + cross-cutting `logAudit` helper.
5. **Storage** — local disk to start, with the storage driver interface designed so swapping in S3 later is a config change, not a refactor.
