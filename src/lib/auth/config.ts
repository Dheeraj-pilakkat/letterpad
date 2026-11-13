import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { getMongoClient, getDb } from "@/lib/db/client";
import { sendEmail } from "@/lib/share";

/**
 * better-auth instance — email + password only.
 * Mounted at /api/auth/[...all].
 */
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  database: mongodbAdapter(getDb(), {
    client: getMongoClient(),
    // Standalone Mongo (local/Docker) rejects transaction numbers; Atlas
    // replica sets work fine without them too.
    transaction: false,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: "Reset your Letterpad password",
        text: `Reset your password: ${url}\n\nIf you didn't request this, you can ignore this email.`,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
});

export type Auth = typeof auth;
