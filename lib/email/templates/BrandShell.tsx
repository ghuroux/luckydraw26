import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export interface BrandOrganisation {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  contactEmail: string | null;
}

interface BrandShellProps {
  organisation: BrandOrganisation;
  preview: string;
  children: ReactNode;
}

const main = {
  backgroundColor: "#f6f6f6",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  margin: 0,
  padding: 0,
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "32px 28px",
  borderRadius: "8px",
};

const headerSection = {
  paddingBottom: "20px",
  borderBottom: "1px solid #e5e7eb",
  marginBottom: "24px",
};

const orgName = {
  margin: "0",
  fontSize: "20px",
  fontWeight: "600",
  letterSpacing: "-0.01em",
  color: "#0f172a",
};

const footer = {
  marginTop: "32px",
  paddingTop: "20px",
  borderTop: "1px solid #e5e7eb",
};

const footerText = {
  margin: "0 0 6px 0",
  fontSize: "12px",
  lineHeight: "1.5",
  color: "#64748b",
};

export function BrandShell({ organisation, preview, children }: BrandShellProps) {
  const accentStyle = { color: organisation.primaryColor };
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            {organisation.logoUrl ? (
              <Img
                src={organisation.logoUrl}
                alt={organisation.name}
                height="36"
                style={{ marginBottom: "12px" }}
              />
            ) : null}
            <Heading as="h1" style={{ ...orgName, ...accentStyle }}>
              {organisation.name}
            </Heading>
          </Section>
          {children}
          <Hr style={{ borderColor: "#e5e7eb", margin: "28px 0 0 0" }} />
          <Section style={footer}>
            <Text style={footerText}>
              Sent by {organisation.name}.
              {organisation.contactEmail
                ? ` Replies go to ${organisation.contactEmail}.`
                : null}
            </Text>
            <Text style={footerText}>
              You&apos;re receiving this because you entered an event run by{" "}
              {organisation.name}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
