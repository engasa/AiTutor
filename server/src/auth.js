/**
 * @file Better Auth configuration with the EduAI OIDC provider.
 *
 * Responsibility: Construct the singleton `auth` instance that backs the
 *   `/api/auth/*` Better Auth handler. Owns provider config (EduAI OIDC),
 *   session/cookie behavior, and the role claim mapping.
 * Callers: `server/src/app.js` (mounts the handler), `server/src/middleware/auth.js`
 *   (calls `auth.api.getSession`).
 * Gotchas:
 *   - Email/password auth is disabled. The only login path is the EduAI
 *     OIDC provider via `genericOAuth`.
 *   - `getUserInfo` reads the namespaced custom claim
 *     `https://eduai.app/role` from the userinfo response. EduAI emits roles
 *     under that URI, not a bare `role` field — changing the URI without
 *     updating EduAI breaks role assignment (everyone defaults to STUDENT).
 *   - `accountLinking.trustedProviders: ['eduai']` allows auto-link by email
 *     on first OAuth login. The `enrollmentSync` job pre-creates `Account`
 *     rows so a brand-new student lands directly in their pre-enrolled
 *     courses without an extra link step.
 *   - Env defaults are dev-only (localhost EduAI mock at :5174). In
 *     production, all `EDUAI_*` and `BETTER_AUTH_*` env vars must be set.
 *   - `BETTER_AUTH_SECRET` is required in production; in dev a hardcoded
 *     fallback is used so `bun run dev` works out of the box.
 * Related: `server/src/middleware/auth.js`, `server/src/jobs/enrollmentSync.js`,
 *   CLAUDE.md (Authentication And Session Model).
 */

import { betterAuth } from 'better-auth';
import { genericOAuth } from 'better-auth/plugins';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './config/database.js';

// Dev defaults assume the EduAI mock provider is running on localhost:5174
// and the API server on localhost:4000. Override every value in production.
const isProd = process.env.NODE_ENV === 'production';
const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:4000/api/auth';
const cookieDomain = process.env.COOKIE_DOMAIN || 'localhost';
const eduAiDiscoveryUrl =
  process.env.EDUAI_DISCOVERY_URL ||
  'http://localhost:5174/api/auth/.well-known/openid-configuration';
const eduAiClientId = process.env.EDUAI_CLIENT_ID || 'aitutor-local';
const eduAiClientSecret = process.env.EDUAI_CLIENT_SECRET || 'aitutor-local-secret';
const eduAiUserInfoUrl =
  process.env.EDUAI_USERINFO_URL || 'http://localhost:5174/api/auth/oauth2/userinfo';
// `JWT_SECRET` is honored only as a legacy fallback; this app no longer uses
// JWTs. Prefer `BETTER_AUTH_SECRET`.
const authSecret =
  process.env.BETTER_AUTH_SECRET ||
  process.env.JWT_SECRET ||
  (isProd ? undefined : 'aitutor-local-dev-secret-change-me');

if (!authSecret) {
  throw new Error('BETTER_AUTH_SECRET must be configured in production');
}

/**
 * Map an EduAI role claim onto the local `Role` enum.
 *
 * Why: EduAI may add roles or send unrecognized values; defaulting unknowns
 * to `STUDENT` is the safe failure mode (least-privilege). Any new role
 * granted by EduAI must be added here AND to the Prisma `Role` enum,
 * otherwise it silently downgrades to STUDENT.
 */
function normalizeEduAiRole(value) {
  if (value === 'ADMIN') return 'ADMIN';
  if (value === 'PROFESSOR') return 'PROFESSOR';
  if (value === 'TA') return 'TA';
  return 'STUDENT';
}

export const auth = betterAuth({
  secret: authSecret,
  // Base URL of the API server hosting the auth handler
  baseURL,

  // Origins permitted to invoke /api/auth/* with credentials. Add new
  // deployment hostnames here; CORS will otherwise reject auth calls.
  trustedOrigins: ['http://localhost:5173', 'https://aitutor.ok.ubc.ca'],

  // Use Prisma as the database adapter (PostgreSQL in this repo)
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        input: false,
        defaultValue: 'STUDENT',
        returned: true,
      },
    },
  },
  emailAndPassword: {
    enabled: false,
  },
  account: {
    accountLinking: {
      // Auto-link EduAI accounts to existing users by email on first login.
      // Required so `enrollmentSync` can pre-provision Account rows and have
      // them attach silently when the student actually signs in.
      trustedProviders: ['eduai'],
      updateUserInfoOnLink: true,
    },
  },

  // Cookie settings for sessions
  cookies: {
    domain: cookieDomain,
    secure: isProd,
    sameSite: 'lax',
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: 'eduai',
          clientId: eduAiClientId,
          clientSecret: eduAiClientSecret,
          discoveryUrl: eduAiDiscoveryUrl,
          scopes: ['openid', 'profile', 'email', 'offline_access'],
          pkce: true,
          requireIssuerValidation: true,
          // Always re-fetch userinfo from EduAI rather than relying on the
          // ID token claims. EduAI mutates roles server-side and we want the
          // freshest value at link/update time.
          overrideUserInfo: true,
          getUserInfo: async (tokens) => {
            const response = await fetch(eduAiUserInfoUrl, {
              headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to fetch EduAI user info: ${response.status}`);
            }

            const profile = await response.json();

            return {
              id: String(profile.sub),
              // Lowercase email so account-linking matches case-insensitively.
              email: String(profile.email || '').toLowerCase(),
              name: String(profile.name || profile.email || 'EduAI User'),
              image: typeof profile.picture === 'string' ? profile.picture : undefined,
              emailVerified: Boolean(profile.email_verified),
              // EduAI emits roles under a namespaced URI claim, not `role`.
              role: normalizeEduAiRole(profile['https://eduai.app/role']),
            };
          },
        },
      ],
    }),
  ],
});
