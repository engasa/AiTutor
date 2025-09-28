import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authenticateToken } from './middleware/auth.js';
import { prisma } from './config/database.js';

// Route imports
import authRoutes from './routes/authentication.js';
import courseRoutes from './routes/courses.js';
import moduleRoutes from './routes/modules.js';
import lessonRoutes from './routes/lessons.js';
import activityRoutes from './routes/activities.js';
import promptRoutes from './routes/prompts.js';
import topicRoutes from './routes/topics.js';
const app = express();

app.use(cors({ origin: true, credentials: true }));
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

// Authentication middleware for protected routes
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/login') {
    return next();
  }
  authenticateToken(req, res, next);
});

// Mount route modules
app.use('/api', authRoutes);
app.use('/api', courseRoutes);
app.use('/api', moduleRoutes);
app.use('/api', lessonRoutes);
app.use('/api', activityRoutes);
app.use('/api', promptRoutes);
app.use('/api', topicRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
