import type { CSSProperties } from "react";
import { db } from "@/lib/db";

export default async function TabletCaptureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const org = await db.organisation.findFirst();

  const themeStyle: CSSProperties = {};
  if (org?.primaryColor) {
    (themeStyle as Record<string, string>)["--primary"] = org.primaryColor;
    (themeStyle as Record<string, string>)["--ring"] = org.primaryColor;
  }
  if (org?.accentColor) {
    (themeStyle as Record<string, string>)["--accent"] = org.accentColor;
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-background text-foreground"
      style={themeStyle}
    >
      {children}
    </div>
  );
}
