import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { attachSession, requireAuth } from './middleware/auth.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { prisma } from './config/database.js';

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
const app = express();

app.use(cors({ origin: true, credentials: true }));

// Mount Better Auth handler BEFORE json parser
// Express v5 uses path-to-regexp v6: use named wildcard capture
app.all('/api/auth/{*any}', toNodeHandler(auth));

// JSON parser for our own routes
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

// Attach session to all /api requests
app.use('/api', attachSession);

// Require auth for all /api routes except health and auth
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/auth/')) {
    return next();
  }
  return requireAuth(req, res, next);
});

// Admins are intentionally isolated to admin-only endpoints for now
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/auth/')) {
    return next();
  }

  if (!req.user) {
    return next();
  }

  if (req.user.role === 'ADMIN') {
    if (req.path === '/me' || req.path.startsWith('/admin/')) {
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
