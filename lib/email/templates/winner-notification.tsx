import { Heading, Section, Text } from "@react-email/components";
import { BrandShell, type BrandOrganisation } from "./BrandShell";

export interface WinnerNotificationContext {
  organisation: BrandOrganisation;
  recipient: { firstName: string; lastName: string };
  event: { name: string };
  prize: { name: string; description: string | null };
  ticketNumbers: number[];
}

export function winnerNotificationSubject(
  ctx: WinnerNotificationContext,
): string {
  return `You won ${ctx.prize.name} at ${ctx.event.name}`;
}

const heading = {
  margin: "0 0 16px 0",
  fontSize: "28px",
  fontWeight: "700",
  letterSpacing: "-0.02em",
  color: "#0f172a",
  lineHeight: "1.2",
};

const body = {
  margin: "0 0 16px 0",
  fontSize: "16px",
  lineHeight: "1.5",
  color: "#1e293b",
};

const ticketBlock = {
  backgroundColor: "#f1f5f9",
  borderRadius: "8px",
  padding: "16px 20px",
  margin: "20px 0",
};

const ticketLabel = {
  margin: "0 0 4px 0",
  fontSize: "12px",
  fontWeight: "600",
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  color: "#64748b",
};

const ticketNumbers = {
  margin: "0",
  fontSize: "16px",
  fontWeight: "600",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  color: "#0f172a",
};

export default function WinnerNotification(ctx: WinnerNotificationContext) {
  const { organisation, recipient, event, prize, ticketNumbers: tickets } = ctx;
  const ticketLine = formatTicketLine(tickets);
  const preview = `Congrats ${recipient.firstName} — you won ${prize.name} at ${event.name}.`;
  return (
    <BrandShell organisation={organisation} preview={preview}>
      <Heading
        as="h2"
        style={{ ...heading, color: organisation.primaryColor }}
      >
        Congrats, {recipient.firstName}!
      </Heading>
      <Text style={body}>
        You won <strong>{prize.name}</strong> at <strong>{event.name}</strong>.
      </Text>
      {prize.description ? (
        <Text style={body}>{prize.description}</Text>
      ) : null}
      <Section style={ticketBlock}>
        <Text style={ticketLabel}>Winning ticket{tickets.length > 1 ? "s" : ""}</Text>
        <Text style={ticketNumbers}>{ticketLine}</Text>
      </Section>
      <Text style={body}>
        We&apos;ll be in touch shortly with details on how to claim your prize.
        {organisation.contactEmail
          ? ` If you have any questions in the meantime, reply to this email or contact ${organisation.contactEmail}.`
          : " If you have any questions in the meantime, just reply to this email."}
      </Text>
      <Text style={body}>Thanks for taking part — and congrats again.</Text>
    </BrandShell>
  );
}

function formatTicketLine(tickets: number[]): string {
  if (tickets.length === 0) return "—";
  if (tickets.length === 1) return `#${tickets[0]}`;
  const sorted = [...tickets].sort((a, b) => a - b);
  return `#${sorted[0]}–#${sorted[sorted.length - 1]}`;
}

WinnerNotification.PreviewProps = {
  organisation: {
    name: "Sample Charity Foundation",
    logoUrl: null,
    primaryColor: "#10b981",
    contactEmail: "hello@samplecharity.org",
  },
  recipient: { firstName: "Jane", lastName: "Doe" },
  event: { name: "Spring Charity Drive 2026" },
  prize: {
    name: "MacBook Pro 16-inch",
    description:
      "Apple M3 Pro chip with 12-core CPU and 18-core GPU, 18GB unified memory, 512GB SSD.",
  },
  ticketNumbers: [128, 129, 130, 131, 132],
} satisfies WinnerNotificationContext;
