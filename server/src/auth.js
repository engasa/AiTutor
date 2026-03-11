import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { genericOAuth } from "better-auth/plugins";
import { prisma } from "./config/database.js";

const isProd = process.env.NODE_ENV === "production";
const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:4000/api/auth";
const cookieDomain = process.env.COOKIE_DOMAIN || "localhost";
const eduAiDiscoveryUrl =
  process.env.EDUAI_DISCOVERY_URL ||
  "http://localhost:5173/api/auth/.well-known/openid-configuration";
const eduAiClientId = process.env.EDUAI_CLIENT_ID || "aitutor-local";
const eduAiClientSecret =
  process.env.EDUAI_CLIENT_SECRET || "aitutor-local-secret";
const authSecret =
  process.env.BETTER_AUTH_SECRET ||
  process.env.JWT_SECRET ||
  (isProd ? undefined : "aitutor-local-dev-secret-change-me");

if (!authSecret) {
  throw new Error("BETTER_AUTH_SECRET must be configured in production");
}

function normalizeEduAiRole(value) {
  if (value === "ADMIN") return "ADMIN";
  if (value === "PROFESSOR") return "PROFESSOR";
  if (value === "TA") return "TA";
  return "STUDENT";
}

export const auth = betterAuth({
  secret: authSecret,
  // Base URL of the API server hosting the auth handler
  baseURL,

  // Allow the frontend dev origin to call auth endpoints
  trustedOrigins: ["http://localhost:5173", "https://aitutor.ok.ubc.ca"],

  // IDs are numeric in our Prisma schema (User.id, Account.userId are Int)
  advanced: {
    database: {
      useNumberId: true,
    },
  },

  // Use Prisma as the database adapter (PostgreSQL in this repo)
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "STUDENT",
        returned: true,
      },
    },
  },
  emailAndPassword: {
    enabled: false,
  },
  account: {
    accountLinking: {
      trustedProviders: ["eduai"],
      updateUserInfoOnLink: true,
    },
  },

  // Cookie settings for sessions
  cookies: {
    domain: cookieDomain,
    secure: isProd,
    sameSite: "lax",
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "eduai",
          clientId: eduAiClientId,
          clientSecret: eduAiClientSecret,
          discoveryUrl: eduAiDiscoveryUrl,
          scopes: ["openid", "profile", "email"],
          pkce: true,
          requireIssuerValidation: true,
          overrideUserInfo: true,
          mapProfileToUser: async (profile) => ({
            role: normalizeEduAiRole(profile["https://eduai.app/role"]),
          }),
        },
      ],
    }),
  ],
});
