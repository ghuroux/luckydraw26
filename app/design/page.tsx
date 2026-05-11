"use client";

import * as React from "react";
import { Calendar, Inbox, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EmptyState,
  PageHeader,
  Pagination,
  Section,
  StatCard,
  StatusBadge,
  type StatusTone,
} from "@/components/shell";
import { cn } from "@/lib/utils";

const colorTokens: Array<{ name: string; varName: string }> = [
  { name: "background", varName: "--background" },
  { name: "foreground", varName: "--foreground" },
  { name: "card", varName: "--card" },
  { name: "surface-sunken", varName: "--surface-sunken" },
  { name: "muted", varName: "--muted" },
  { name: "muted-foreground", varName: "--muted-foreground" },
  { name: "border", varName: "--border" },
  { name: "primary", varName: "--primary" },
  { name: "accent", varName: "--accent" },
  { name: "celebration", varName: "--celebration" },
  { name: "celebration-soft", varName: "--celebration-soft" },
  { name: "destructive", varName: "--destructive" },
];

const displaySizes: Array<{ label: string; cls: string; sample: string }> = [
  { label: "display-2xl", cls: "text-display-2xl", sample: "Lucky Draw" },
  { label: "display-xl", cls: "text-display-xl", sample: "Winner moment" },
  { label: "display-lg", cls: "text-display-lg", sample: "Premium hero" },
  { label: "display-md", cls: "text-display-md", sample: "Big page title" },
  { label: "display-sm", cls: "text-display-sm", sample: "Section hero" },
  { label: "display-xs", cls: "text-display-xs", sample: "Standard page title" },
  { label: "display-2xs", cls: "text-display-2xs", sample: "Small display" },
];

const bodySizes: Array<{ label: string; cls: string; sample: string }> = [
  { label: "text-xl", cls: "text-xl", sample: "Lead paragraph copy" },
  { label: "text-lg", cls: "text-lg", sample: "Lead paragraph copy" },
  { label: "text-base", cls: "text-base", sample: "Body copy at base size" },
  { label: "text-sm", cls: "text-sm", sample: "Secondary copy and labels" },
  { label: "text-xs", cls: "text-xs", sample: "Caption / meta text" },
];

const shadows: Array<{ label: string; cls: string }> = [
  { label: "shadow-2xs", cls: "shadow-2xs" },
  { label: "shadow-xs", cls: "shadow-xs" },
  { label: "shadow-sm", cls: "shadow-sm" },
  { label: "shadow-md", cls: "shadow-md" },
  { label: "shadow-lg", cls: "shadow-lg" },
  { label: "shadow-xl", cls: "shadow-xl" },
  { label: "shadow-2xl", cls: "shadow-2xl" },
];

const tones: StatusTone[] = ["neutral", "info", "success", "warning", "danger", "muted"];

export default function DesignPreviewPage() {
  const [motionKey, setMotionKey] = React.useState(0);
  const [activeMotion, setActiveMotion] = React.useState<
    "page" | "dialog" | "step" | null
  >(null);

  const replay = (kind: "page" | "dialog" | "step") => {
    setActiveMotion(kind);
    setMotionKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-12 space-y-16">
        <PageHeader
          eyebrow="Design system"
          title="Foundations"
          description="A live preview of the refreshed token system, type scale, elevation, primitives, and motion presets. This page is dev-only — remove before launch."
          actions={
            <>
              <Button variant="outline" size="sm">Docs</Button>
              <Button size="sm">Promote</Button>
            </>
          }
        />

        {/* Colors */}
        <SectionBlock title="Colors" description="Semantic tokens. Org accent is themable; celebration gold is fixed.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {colorTokens.map((c) => (
              <div
                key={c.name}
                className="rounded-xl bg-card p-4 ring-1 ring-foreground/8"
              >
                <div
                  className="h-16 w-full rounded-lg ring-1 ring-foreground/5"
                  style={{ background: `var(${c.varName})` }}
                />
                <div className="mt-3 space-y-0.5">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {c.varName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionBlock>

        {/* Surfaces */}
        <SectionBlock
          title="Surfaces"
          description="Layered depth without borders — page sits a hair warmer than card."
        >
          <div className="rounded-xl bg-surface-sunken p-6 ring-1 ring-foreground/5">
            <p className="mb-4 font-mono text-xs uppercase tracking-wide text-muted-foreground">
              surface-sunken (containers / empty wells)
            </p>
            <div className="rounded-xl bg-background p-6 ring-1 ring-foreground/8">
              <p className="mb-4 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                background (page)
              </p>
              <div className="rounded-xl bg-card p-6 shadow-xs ring-1 ring-foreground/8">
                <p className="mb-4 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  card (default content surface)
                </p>
                <div className="rounded-xl bg-surface-elevated p-6 shadow-md ring-1 ring-foreground/10">
                  <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    surface-elevated (popovers, dialogs)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SectionBlock>

        {/* Typography */}
        <SectionBlock
          title="Typography"
          description="Geist sans for prose; Geist mono for numbers, IDs, and stat readouts. Display tier has tight tracking for hero moments."
        >
          <div className="space-y-6">
            <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/8 space-y-5">
              <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                Display
              </p>
              {displaySizes.map((s) => (
                <div key={s.label} className="flex items-baseline justify-between gap-6 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                  <p className={cn(s.cls, "font-semibold")}>{s.sample}</p>
                  <p className="font-mono text-xs text-muted-foreground shrink-0">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/8 space-y-3">
                <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  Body
                </p>
                {bodySizes.map((s) => (
                  <div key={s.label} className="flex items-baseline justify-between gap-4">
                    <p className={s.cls}>{s.sample}</p>
                    <p className="font-mono text-xs text-muted-foreground shrink-0">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/8 space-y-3">
                <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  Mono
                </p>
                <p className="font-mono text-display-md font-semibold tabular-nums">
                  R 12,480.00
                </p>
                <p className="font-mono text-2xl tabular-nums">#0042</p>
                <p className="font-mono text-sm text-muted-foreground">
                  cm5x91k0p0001a2b3c4d5e6f7
                </p>
              </div>
            </div>
          </div>
        </SectionBlock>

        {/* Elevation */}
        <SectionBlock
          title="Elevation"
          description="Soft, low-spread shadows tinted with slate. Use shadow-xs for resting cards, shadow-md for hover, shadow-xl for floating panels."
        >
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 bg-surface-sunken p-8 rounded-xl">
            {shadows.map((s) => (
              <div
                key={s.label}
                className={cn("rounded-xl bg-card p-6 text-center", s.cls)}
              >
                <p className="font-mono text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </SectionBlock>

        {/* Status badges */}
        <SectionBlock
          title="Status badges"
          description="One component, six tones, optional dot. Replaces ad-hoc badge mappings across event/prize/winner UIs."
        >
          <div className="flex flex-wrap gap-3">
            {tones.map((tone) => (
              <StatusBadge key={tone} tone={tone} dot>
                {tone}
              </StatusBadge>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <StatusBadge tone="muted">Draft</StatusBadge>
            <StatusBadge tone="success" dot>Open</StatusBadge>
            <StatusBadge tone="info">Closed</StatusBadge>
            <StatusBadge tone="neutral">Drawn</StatusBadge>
            <StatusBadge tone="warning" dot>Parked</StatusBadge>
            <StatusBadge tone="success">Awarded</StatusBadge>
            <StatusBadge tone="danger">Voided</StatusBadge>
          </div>
        </SectionBlock>

        {/* Stat cards */}
        <SectionBlock
          title="Stat cards"
          description="Mono numbers, uppercase labels, optional trend chip and href."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Entries" value="248" hint="this event" />
            <StatCard label="Prizes" value="12" href="#" />
            <StatCard
              label="Revenue"
              value="R 12,480"
              trend={{ value: "+18%", direction: "up" }}
              hint="vs last event"
            />
            <StatCard
              label="No-shows"
              value="3"
              trend={{ value: "-2", direction: "down" }}
              hint="reconciled"
            />
          </div>
        </SectionBlock>

        {/* Section primitive */}
        <SectionBlock
          title="Section primitive"
          description="Wraps the form-card pattern used across edit/create surfaces."
        >
          <Section
            title="Basics"
            description="High-level details about the event."
            actions={<Button variant="outline" size="sm">Edit</Button>}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Event name</Label>
                <Input defaultValue="May 2026 Lucky Draw" />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" defaultValue="2026-05-31" />
              </div>
            </div>
          </Section>
        </SectionBlock>

        {/* Empty state */}
        <SectionBlock
          title="Empty state"
          description="Centered, dashed-border well. Replaces two copies in events + entrants pages."
        >
          <EmptyState
            icon={<Inbox />}
            title="No entrants yet"
            description="Entrants are created the first time they're added to an event. Add one from the entries tab to get started."
            action={<Button size="sm">Add entrant</Button>}
          />
        </SectionBlock>

        {/* Pagination */}
        <SectionBlock
          title="Pagination"
          description="Generic — takes a buildUrl function so it works for any list."
        >
          <Pagination
            page={2}
            totalPages={8}
            hasPrev
            hasNext
            buildUrl={(p) => `#page=${p}`}
          />
        </SectionBlock>

        {/* Buttons & badges (existing) */}
        <SectionBlock
          title="Buttons & badges (existing)"
          description="The existing button + badge primitives, against the new tokens."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Primary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="xs">xs</Button>
              <Button size="sm">sm</Button>
              <Button size="default">default</Button>
              <Button size="lg">lg</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>default</Badge>
              <Badge variant="secondary">secondary</Badge>
              <Badge variant="outline">outline</Badge>
              <Badge variant="destructive">destructive</Badge>
            </div>
          </div>
        </SectionBlock>

        {/* Motion */}
        <SectionBlock
          title="Motion presets"
          description="Three named transitions. Replay each to preview."
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => replay("page")}>
              Replay enter-page
            </Button>
            <Button variant="outline" size="sm" onClick={() => replay("dialog")}>
              Replay enter-dialog
            </Button>
            <Button variant="outline" size="sm" onClick={() => replay("step")}>
              Replay enter-step
            </Button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {(["page", "dialog", "step"] as const).map((kind) => (
              <div
                key={`${kind}-${motionKey}`}
                className={cn(
                  "rounded-xl bg-card p-6 ring-1 ring-foreground/8 shadow-sm",
                  activeMotion === kind && `animate-enter-${kind}`
                )}
              >
                <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  enter-{kind}
                </p>
                <p className="mt-2 text-base font-medium">Animated surface</p>
              </div>
            ))}
          </div>
        </SectionBlock>

        {/* Celebration sample */}
        <SectionBlock
          title="Celebration moment (preview)"
          description="A first taste of the showcase direction — fixed gold, deep dark surface, hero typography. Phase C will polish the real winner card."
        >
          <div className="relative overflow-hidden rounded-2xl bg-zinc-950 p-12 text-center">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(60% 60% at 50% 40%, color-mix(in oklch, var(--celebration) 35%, transparent), transparent 70%)",
              }}
            />
            <div className="relative space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.3em]" style={{ color: "color-mix(in oklch, var(--celebration) 70%, white)" }}>
                Grand prize · R 50,000
              </p>
              <h2 className="text-display-xl font-semibold text-white sm:text-display-2xl" style={{ textShadow: "0 0 60px color-mix(in oklch, var(--celebration) 40%, transparent)" }}>
                Sarah Mokoena
              </h2>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white ring-1 ring-white/15">
                <Sparkles className="size-3.5" style={{ color: "var(--celebration)" }} />
                <span className="font-mono tabular-nums">Ticket #0247</span>
              </div>
            </div>
          </div>
        </SectionBlock>

        <footer className="pt-8 pb-4 text-center text-xs text-muted-foreground">
          Phase A foundations · {new Date().toLocaleDateString()}
        </footer>
      </div>
    </div>
  );
}

function SectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-display-2xs font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
