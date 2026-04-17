/**
 * @file Express application factory wiring auth, RBAC, and domain routes.
 *
 * Responsibility: Build a fully configured Express app with Better Auth
 *   mounted, session/RBAC middleware chained, and all `/api/*` route modules
 *   registered.
 * Callers: `server/src/index.js` (production entry) and integration tests
 *   that pass `{ mockUser }` to bypass real auth.
 * Gotchas:
 *   - Better Auth handler is mounted BEFORE `express.json()`. Better Auth
 *     reads the raw request body itself; if JSON parsing runs first the body
 *     is consumed and OAuth/email flows break. Do not reorder.
 *   - Middleware order on `/api` is load-bearing: `attachSession` populates
 *     `req.user`, then `requireAuth` rejects anonymous traffic, then the
 *     admin-isolation gate confines ADMIN users.
 *   - Admin-isolation deliberately INVERTS the usual "admin sees all"
 *     assumption: ADMINs get 403 on every path that is not whitelisted by
 *     `isAllowedAdminPath`. Course/lesson/activity tooling is for
 *     STUDENT/PROFESSOR/TA only.
 * Related: `server/src/auth.js`, `server/src/middleware/auth.js`,
 *   `CLAUDE.md` (Authentication And Session Model).
 */

import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';

// Route imports
import authRoutes from './routes/authentication.js';
import courseRoutes from './routes/courses.js';
import moduleRoutes from './routes/modules.js';
import lessonRoutes from './routes/lessons.js';
import activityRoutes from './routes/activities.js';
import promptRoutes from './routes/prompts.js';
import topicRoutes from './routes/topics.js';
import aiModelRoutes from './routes/ai-models.js';
import adminRoutes from './routes/admin.js';
import suggestedPromptRoutes from './routes/suggested-prompts.js';
import bugReportRoutes from './routes/bug-reports.js';
import { prisma } from './config/database.js';

/**
 * Whitelist for the admin-isolation gate.
 *
 * Why: ADMINs are a tooling persona, not a "superuser". They manage users,
 * AI model policy, and system settings — they do not browse course content.
 * Keep this list narrow; widening it leaks course-management surface to
 * admins and breaks the role separation enforced elsewhere.
 */
function isAllowedAdminPath(path) {
  return (
    path === '/me' ||
    path.startsWith('/admin/') ||
    path === '/ai-models' ||
    path.startsWith('/ai-models/')
  );
}

/**
 * Creates and configures the Express application.
 *
 * @param {object} [options]
 * @param {object} [options.mockUser] - When provided, skips Better Auth and
 *   injects this object as `req.user` on every request. Used by tests so
 *   they can exercise route handlers without standing up an OAuth provider.
 * @returns {Promise<import('express').Express>}
 *
 * Why: A factory (rather than a top-level singleton) lets tests build
 *   isolated apps with synthetic users and avoids importing `auth.js` (which
 *   touches Prisma) when running pure-handler tests.
 */
export async function createApp(options = {}) {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));

  if (!options.mockUser) {
    // Mount Better Auth raw-body handler BEFORE express.json(). Better Auth
    // parses its own request bodies; running express.json() first consumes
    // the stream and breaks every auth endpoint.
    const { toNodeHandler } = await import('better-auth/node');
    const { auth } = await import('./auth.js');
    app.all('/api/auth/{*any}', toNodeHandler(auth));
  }

  // JSON parser applies only to our own /api/* handlers below.
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // Session middleware: real Better Auth lookup, or test-mode injection.
  if (options.mockUser) {
    app.use('/api', (req, res, next) => {
      req.user = options.mockUser;
      next();
    });
  } else {
    const { attachSession } = await import('./middleware/auth.js');
    app.use('/api', attachSession);
  }

  // Reject unauthenticated callers everywhere except the health probe and
  // the Better Auth handler (which manages its own auth state).
  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/auth/')) {
      return next();
    }
    return requireAuth(req, res, next);
  });

  // Admin-isolation gate. ADMINs are confined to /me, /admin/*, and
  // /ai-models* — anything else 403s. This is the inverse of the typical
  // "admin sees all" pattern; see file header for rationale.
  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/auth/')) {
      return next();
    }
    if (!req.user) {
      return next();
    }
    if (req.user.role === 'ADMIN') {
      if (isAllowedAdminPath(req.path)) {
        return next();
      }
      return res.status(403).json({ error: 'Admins can only access admin endpoints' });
    }
    next();
  });

  // Mount route modules
  app.use('/api', authRoutes);
  app.use('/api', courseRoutes);
  app.use('/api', moduleRoutes);
  app.use('/api', lessonRoutes);
  app.use('/api', activityRoutes);
  app.use('/api', promptRoutes);
  app.use('/api', topicRoutes);
  app.use('/api', aiModelRoutes);
  app.use('/api', adminRoutes);
  app.use('/api', suggestedPromptRoutes);
  app.use('/api', bugReportRoutes);

  return app;
}
