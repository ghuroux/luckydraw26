import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function ensureSuperadmin(email: string, password: string) {
  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role === "SUPERADMIN") {
      console.log(`✓ ${email} already exists as SUPERADMIN.`);
      return;
    }
    await db.user.update({
      where: { email },
      data: { role: "SUPERADMIN" },
    });
    console.log(`✓ Promoted existing user ${email} to SUPERADMIN.`);
    return;
  }

  await auth.api.signUpEmail({
    body: { email, password, name: "Super Admin" },
  });
  await db.user.update({
    where: { email },
    data: { role: "SUPERADMIN" },
  });
  console.log(`✓ Created SUPERADMIN: ${email}`);
}

async function ensureDefaultOrganisation() {
  const existing = await db.organisation.findFirst();
  if (existing) {
    console.log(`✓ Organisation already exists: ${existing.name}`);
    return;
  }

  const org = await db.organisation.create({
    data: {
      name: "Lucky Draw",
      slug: "default",
      contactEmail: "info@luckydraw.local",
    },
  });
  console.log(`✓ Created default Organisation: ${org.name}`);
}

async function main() {
  const email = process.env.BOOTSTRAP_EMAIL;
  const password = process.env.BOOTSTRAP_PASSWORD;

  if (!email || !password) {
    console.error(
      "Missing BOOTSTRAP_EMAIL or BOOTSTRAP_PASSWORD in environment.",
    );
    process.exit(1);
  }

  await ensureSuperadmin(email, password);
  await ensureDefaultOrganisation();
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
