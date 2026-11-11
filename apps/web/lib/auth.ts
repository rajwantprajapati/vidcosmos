// Authentication (SDD §14, API §4, DB §3): Better Auth with the MongoDB adapter.
//
// - Email and password (10-128 characters) with email verification, and Google sign-in.
// - Sign-up signs the person in and sends a verification link; unverified users can use the
//   app but not generate or post (enforced by those features with EMAIL_NOT_VERIFIED).
// - A workspace is created in the sign-up request (DB §4).
// - Sessions last 30 days and are extended at most once a day (DB §3).
// - Rate limits (API §16) are kept in the `rateLimit` collection, so they hold across
//   server instances.
import { defaultNotificationPrefs, defaultTimeZone } from "@vidcosmos/spec/collections";
import { ensureWorkspace, ObjectId } from "@vidcosmos/db";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import "server-only";
import { env } from "@/env";
import { resetPasswordMessage, verifyEmailMessage } from "./auth-emails";
import { deletingAccountMessage, passwordRules } from "./auth-rules";
import { getDb } from "./db";
import { email } from "./email";

const day = 24 * 60 * 60;

const db = getDb();

export const auth = betterAuth({
  appName: "Vidcosmos",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],
  // No client: Better Auth's own writes don't need transactions, and a standalone local
  // MongoDB can't run them.
  database: mongodbAdapter(db),
  telemetry: { enabled: false },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: passwordRules.min,
    maxPasswordLength: passwordRules.max,
    // Signing in right away is also what lets a duplicate email get a clear message:
    // with autoSignIn off, Better Auth answers every sign-up with the same fake success.
    autoSignIn: true,
    requireEmailVerification: false,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await email.send(resetPasswordMessage(user, url));
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    expiresIn: day,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      await email.send(verifyEmailMessage(user, url));
    },
  },

  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            prompt: "select_account",
          },
        }
      : {},

  account: {
    // A Google identity is never attached to an existing password account during sign-in;
    // the owner links it from Settings while signed in (SDD §14, account linking).
    accountLinking: { enabled: true, disableImplicitLinking: true },
  },

  session: {
    expiresIn: 30 * day,
    updateAge: day,
  },

  user: {
    additionalFields: {
      // `input: false`: never accepted from the client.
      role: { type: ["user", "admin"], required: true, defaultValue: "user", input: false },
      timeZone: { type: "string", required: true, defaultValue: defaultTimeZone, input: false },
      locale: { type: ["en", "hi"], required: true, defaultValue: "en", input: false },
      status: {
        type: ["active", "deleting"],
        required: true,
        defaultValue: "active",
        input: false,
      },
    },
  },

  rateLimit: {
    // Better Auth turns this on in production only; tests and development run without it.
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-in/social": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60 * 60, max: 3 },
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const id = new ObjectId(user.id);
          // Objects the app owns on the user document (stored as real objects, not JSON text).
          await db
            .collection("user")
            .updateOne({ _id: id }, { $set: { notificationPrefs: defaultNotificationPrefs } });
          await ensureWorkspace(db, { id, name: user.name });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await db
            .collection<{ status?: string }>("user")
            .findOne({ _id: new ObjectId(session.userId) }, { projection: { status: 1 } });
          if (user?.status === "deleting") {
            throw new APIError("FORBIDDEN", { message: deletingAccountMessage });
          }
        },
      },
    },
  },

  plugins: [
    // The breach check calls haveibeenpwned.com, so it runs only with live email (real
    // users); stub mode and tests never call it.
    ...(env.providers.email === "live" ? [haveIBeenPwned()] : []),
    // Lets server actions set the session cookie; must be last.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
