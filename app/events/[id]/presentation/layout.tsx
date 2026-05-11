import type { CSSProperties } from "react";

import { db } from "@/lib/db";

export default async function PresentationLayout({
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
      className="relative min-h-screen w-full overflow-hidden bg-zinc-950 text-zinc-100"
      style={themeStyle}
    >
      {/* Cinematic vignette: subtle warm pull from centre + edge fade. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 40%, color-mix(in oklch, var(--celebration) 6%, transparent), transparent 70%), radial-gradient(120% 80% at 50% 100%, rgba(0,0,0,0.55), transparent 60%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
