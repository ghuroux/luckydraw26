import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "STAFF",
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
});

export type Session = typeof auth.$Infer.Session;
