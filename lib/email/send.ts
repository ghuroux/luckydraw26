import "server-only";
import {
  createElement,
  type ComponentType,
  type ReactElement,
} from "react";
import nodemailer from "nodemailer";
import { render } from "@react-email/render";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  TEMPLATES,
  type TemplateContextMap,
  type TemplateName,
} from "./registry";

const ERROR_MAX_LEN = 500;

export interface SendEmailArgs {
  to: string;
  subject: string;
  // Template name stored on EmailLog (e.g. "winner-notification"). Used by
  // the email-log UI to filter, and by Retry to re-render via the registry.
  template: string;
  // Pre-built React element. In 4b a sendTemplateEmail() wrapper resolves
  // a template name + context into the right element.
  body: ReactElement;
  // Free-form JSON payload also stored on EmailLog. Used for Retry/Resend
  // (the registry re-renders from this) and operator inspection.
  context: Record<string, unknown>;
}

export type SendEmailResult =
  | { ok: true; emailLogId: string }
  | { ok: false; emailLogId: string; error: string };

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const html = await render(args.body);
  const text = await render(args.body, { plainText: true });

  const log = await db.emailLog.create({
    data: {
      to: args.to,
      subject: args.subject,
      template: args.template,
      context: args.context as Prisma.InputJsonValue,
      attempts: 1,
      lastAttemptAt: new Date(),
    },
  });

  return await deliver(log.id, args.to, args.subject, html, text);
}

// High-level wrapper: resolves a template name + typed context to the
// rendered React element + subject and hands off to sendEmail. Use this
// from app code; sendEmail() is the lower-level escape hatch for ad-hoc
// or test renders that aren't in the registry.
export async function sendTemplateEmail<K extends TemplateName>(args: {
  to: string;
  template: K;
  context: TemplateContextMap[K];
}): Promise<SendEmailResult> {
  const entry = TEMPLATES[args.template];
  const subject = entry.subject(args.context);
  const body = createElement(
    entry.Component as ComponentType<TemplateContextMap[K]>,
    args.context,
  );
  return sendEmail({
    to: args.to,
    subject,
    template: args.template,
    body,
    context: args.context as unknown as Record<string, unknown>,
  });
}

// Re-runs delivery on an existing EmailLog row. Re-renders from the stored
// context (the same JSON that went into the original send) via the
// registry, increments attempts, updates lastAttemptAt regardless of
// outcome. Used by the email-log UI's Retry button (Phase 4e). Resend
// (also Phase 4e) creates a fresh row via sendTemplateEmail() so each
// resend is independently auditable.
export async function retrySend(
  emailLogId: string,
): Promise<SendEmailResult> {
  const existing = await db.emailLog.findUnique({ where: { id: emailLogId } });
  if (!existing) {
    return { ok: false, emailLogId, error: "Email log row not found." };
  }
  const entry = TEMPLATES[existing.template as TemplateName];
  if (!entry) {
    return {
      ok: false,
      emailLogId,
      error: `Unknown template: ${existing.template}`,
    };
  }
  // The stored context is JSON; we trust it matches the template's shape
  // because sendTemplateEmail's compile-time typing was the only writer.
  const ctx = existing.context as unknown as TemplateContextMap[TemplateName];
  const subject = entry.subject(ctx);
  const body = createElement(
    entry.Component as ComponentType<TemplateContextMap[TemplateName]>,
    ctx,
  );
  const html = await render(body);
  const text = await render(body, { plainText: true });
  await db.emailLog.update({
    where: { id: emailLogId },
    data: {
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      subject,
    },
  });
  return await deliver(emailLogId, existing.to, subject, html, text);
}

async function deliver(
  emailLogId: string,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<SendEmailResult> {
  // Dev fallback: when SMTP_HOST is unset, log to stdout and mark sent so
  // the email-log UI exercises end-to-end without a real SMTP server.
  if (!process.env.SMTP_HOST) {
    console.log(
      `[DEV-EMAIL] to=${to} subject=${JSON.stringify(subject)} (logId=${emailLogId})`,
    );
    await db.emailLog.update({
      where: { id: emailLogId },
      data: { sentAt: new Date(), error: null },
    });
    return { ok: true, emailLogId };
  }

  const replyTo = await resolveReplyTo();
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS ?? "",
        }
      : undefined,
  });

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to,
      replyTo,
      subject,
      html,
      text,
    });
    await db.emailLog.update({
      where: { id: emailLogId },
      data: { sentAt: new Date(), error: null },
    });
    return { ok: true, emailLogId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const truncated = msg.slice(0, ERROR_MAX_LEN);
    await db.emailLog.update({
      where: { id: emailLogId },
      data: { error: truncated },
    });
    return { ok: false, emailLogId, error: truncated };
  }
}

async function resolveReplyTo(): Promise<string | undefined> {
  const org = await db.organisation.findFirst({
    select: { contactEmail: true },
  });
  return org?.contactEmail ?? process.env.SMTP_FROM ?? undefined;
}
