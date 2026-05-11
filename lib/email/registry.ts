import "server-only";
import type { ComponentType } from "react";
import WinnerNotification, {
  winnerNotificationSubject,
  type WinnerNotificationContext,
} from "./templates/winner-notification";

// Registry of every named template the app can send. Adding a template
// means adding an entry here so sendTemplateEmail's caller-side typing
// + the email-log Retry path both find it.
export interface TemplateContextMap {
  "winner-notification": WinnerNotificationContext;
}

export type TemplateName = keyof TemplateContextMap;

interface TemplateEntry<K extends TemplateName> {
  Component: ComponentType<TemplateContextMap[K]>;
  subject: (ctx: TemplateContextMap[K]) => string;
}

type Registry = { [K in TemplateName]: TemplateEntry<K> };

export const TEMPLATES: Registry = {
  "winner-notification": {
    Component: WinnerNotification,
    subject: winnerNotificationSubject,
  },
};
