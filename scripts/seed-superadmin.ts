import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function main() {
  const email = process.env.BOOTSTRAP_EMAIL;
  const password = process.env.BOOTSTRAP_PASSWORD;

  if (!email || !password) {
    console.error(
      "Missing BOOTSTRAP_EMAIL or BOOTSTRAP_PASSWORD in environment.",
    );
    process.exit(1);
  }

  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role === "SUPERADMIN") {
      console.log(`✓ ${email} already exists as SUPERADMIN — nothing to do.`);
    } else {
      await db.user.update({
        where: { email },
        data: { role: "SUPERADMIN" },
      });
      console.log(`✓ Promoted existing user ${email} to SUPERADMIN.`);
    }
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

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
