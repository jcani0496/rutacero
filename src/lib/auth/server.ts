import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, twoFactor } from "better-auth/plugins";

import { getDb, schema } from "@/db/client";
import { sendEmail } from "@/lib/resend/client";

function appBaseUrl() {
  return (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

async function sendOtpEmail(params: {
  email: string;
  otp: string;
  type: string;
}) {
  const subjects: Record<string, string> = {
    "sign-in": "Tu código de acceso — RutaCero",
    "email-verification": "Verificá tu correo — RutaCero",
    "forget-password": "Restablecé tu contraseña — RutaCero",
    "change-email": "Confirmá tu nuevo correo — RutaCero",
  };

  const html = `
    <p>Hola,</p>
    <p>Tu código de RutaCero es:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:4px">${params.otp}</p>
    <p>Caduca en unos minutos. Si no pediste este código, ignorá este mensaje.</p>
  `;

  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[auth:otp] ${params.type} → ${params.email}: ${params.otp}`);
      return;
    }
    throw new Error("RESEND_API_KEY not configured");
  }

  await sendEmail({
    to: params.email,
    subject: subjects[params.type] || "Tu código — RutaCero",
    html,
  });
}

/**
 * Lazy better-auth server instance.
 *
 * Default production path is better-auth + drizzle (F6 cutover).
 * Laziness keeps `next build` from requiring DATABASE_URL at import time.
 */
export function getAuth() {
  const globalForAuth = globalThis as unknown as {
    // Keep as unknown to avoid better-auth generic widening conflicts
    // between the plugin-augmented instance and a bare Auth<> cache type.
    __rutaceroAuth?: ReturnType<typeof createAuthInstance>;
  };

  if (globalForAuth.__rutaceroAuth) {
    return globalForAuth.__rutaceroAuth;
  }

  const instance = createAuthInstance();
  globalForAuth.__rutaceroAuth = instance;
  return instance;
}

function createAuthInstance() {
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is not set");
  }

  return betterAuth({
    appName: "RutaCero",
    baseURL: appBaseUrl(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      // With usePlural, adapter looks up schema keys as "users"/"sessions"/…
      usePlural: true,
      schema: {
        users: schema.users,
        sessions: schema.sessions,
        accounts: schema.accounts,
        verifications: schema.verifications,
        twoFactors: schema.twoFactors,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    advanced: {
      database: {
        generateId: () => crypto.randomUUID(),
      },
      cookiePrefix: "rutacero",
    },
    plugins: [
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          await sendOtpEmail({ email, otp, type });
        },
        otpLength: 6,
        expiresIn: 10 * 60,
      }),
      twoFactor({
        issuer: "RutaCero",
      }),
      nextCookies(),
    ],
  });
}
