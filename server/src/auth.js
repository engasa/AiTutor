import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './config/database.js';

const isProd = process.env.NODE_ENV === 'production';
const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:4000/api/auth';
const cookieDomain = process.env.COOKIE_DOMAIN || 'localhost';

export const auth = betterAuth({
  // Base URL of the API server hosting the auth handler
  baseURL,

  // Allow the frontend dev origin to call auth endpoints
  trustedOrigins: [
    'http://localhost:5173',
  ],

  // IDs are numeric in our Prisma schema (User.id, Account.userId are Int)
  advanced: {
    database: {
      useNumberId: true,
    },
  },

  // Use Prisma as the database adapter (PostgreSQL in this repo)
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  // Enable simple email + password
  emailAndPassword: {
    enabled: true,
  },

  // Cookie settings for sessions
  cookies: {
    domain: cookieDomain,
    secure: isProd,
    sameSite: 'lax',
  },
});
