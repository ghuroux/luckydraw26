import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  className?: string;
}

/**
 * Form-card pattern: a titled card section used across edit/create surfaces.
 * Wraps shadcn Card to keep the title/description/actions header consistent.
 */
export function Section({
  title,
  description,
  actions,
  children,
  contentClassName,
  className,
}: SectionProps) {
  return (
    <Card className={cn("gap-5 py-5", className)}>
      <CardHeader className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight">
            {title}
          </CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent className={cn("space-y-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
