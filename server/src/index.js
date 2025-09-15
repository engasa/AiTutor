import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from './middleware/auth.js';

dotenv.config();
const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return token and user without password
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      token,
      user: userWithoutPassword
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Protect all API routes except health and login
app.use('/api', (req, res, next) => {
  // Skip auth for public endpoints
  if (req.path === '/health' || req.path === '/login') {
    return next();
  }
  // Apply auth middleware for all other API routes
  authenticateToken(req, res, next);
});

// Users (instructor only)
app.get('/api/users', requireRole('INSTRUCTOR'), async (req, res) => {
  const { role } = req.query;
  try {
    const users = await prisma.user.findMany({
      where: role ? { role: String(role).toUpperCase() } : undefined,
      orderBy: { id: 'asc' },
    });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const authUser = req.user;
  if (!authUser) return res.status(401).json({ error: 'Authentication required' });
  if (authUser.role !== 'INSTRUCTOR' && authUser.id !== id) {
    return res.status(403).json({ error: 'Not authorized to view this user' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Courses for user (student enrollments or instructor teachings)
app.get('/api/courses', async (req, res) => {
  const authUser = req.user;
  if (!authUser) return res.status(401).json({ error: 'Authentication required' });

  let lookupId = authUser.id;
  if (req.query.userId !== undefined) {
    const requestedId = Number(req.query.userId);
    if (!Number.isFinite(requestedId)) {
      return res.status(400).json({ error: 'userId must be a number' });
    }
    if (authUser.role !== 'INSTRUCTOR' && requestedId !== authUser.id) {
      return res.status(403).json({ error: 'Not authorized to view courses for this user' });
    }
    lookupId = requestedId;
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: lookupId } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (targetUser.role === 'STUDENT') {
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: lookupId },
        include: { course: true },
      });
      res.json(enrollments.map((e) => e.course));
    } else {
      const teachings = await prisma.teachingAssignment.findMany({
        where: { userId: lookupId },
        include: { course: true },
      });
      res.json(teachings.map((t) => t.course));
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Topics for a course
app.get('/api/courses/:courseId/topics', async (req, res) => {
  const courseId = Number(req.params.courseId);
  try {
    const topics = await prisma.topic.findMany({ where: { courseId }, orderBy: { id: 'asc' } });
    res.json(topics);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Lists for a topic
app.get('/api/topics/:topicId/lists', async (req, res) => {
  const topicId = Number(req.params.topicId);
  try {
    const lists = await prisma.questionList.findMany({ where: { topicId }, orderBy: { id: 'asc' } });
    res.json(lists);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/lists/:listId', async (req, res) => {
  const listId = Number(req.params.listId);
  try {
    const list = await prisma.questionList.findUnique({ where: { id: listId }, include: { topic: true } });
    if (!list) return res.status(404).json({ error: 'List not found' });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Questions in a list (without revealing answers)
app.get('/api/lists/:listId/questions', async (req, res) => {
  const listId = Number(req.params.listId);
  try {
    const questions = await prisma.question.findMany({
      where: { listId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        prompt: true,
        type: true,
        options: true,
        hints: true,
      },
    });
    res.json(questions);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Submit answer
app.post('/api/questions/:id/answer', async (req, res) => {
  const id = Number(req.params.id);
  const { userId, answerText, answerOption } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const q = await prisma.question.findUnique({ where: { id } });
    if (!q) return res.status(404).json({ error: 'Question not found' });

    let isCorrect = null;
    if (q.type === 'MCQ' && typeof answerOption === 'number') {
      const correctIndex = (q.answer && q.answer.correctIndex) ?? null;
      isCorrect = correctIndex !== null && answerOption === correctIndex;
    } else if (q.type === 'SHORT_TEXT' && typeof answerText === 'string') {
      const expected = (q.answer && q.answer.text) ? String(q.answer.text) : '';
      isCorrect = expected && answerText.trim().toLowerCase() === expected.trim().toLowerCase();
    }

    await prisma.studentAnswer.create({
      data: {
        userId,
        questionId: id,
        answerText: answerText ?? null,
        answerOption: answerOption ?? null,
        isCorrect,
      },
    });

    // Minimal assistant guidance from server (non-LLM, simple cue)
    const hint = Array.isArray(q.hints) && q.hints.length > 0 ? q.hints[0] : 'Reflect on the key concept in the prompt.';

    res.json({ ok: true, isCorrect, message: isCorrect ? 'Nice! That looks right.' : 'Not quite. Try another angle.', assistantCue: hint });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Create list (instructor)
app.post('/api/lists', requireRole('INSTRUCTOR'), async (req, res) => {
  const { title, topicId } = req.body || {};
  if (!title || !topicId) return res.status(400).json({ error: 'title and topicId required' });
  try {
    const list = await prisma.questionList.create({ data: { title, topicId: Number(topicId) } });
    res.status(201).json(list);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Create question in list (instructor)
app.post('/api/lists/:listId/questions', requireRole('INSTRUCTOR'), async (req, res) => {
  const listId = Number(req.params.listId);
  const { prompt, type, options, answer, hints } = req.body || {};
  if (!prompt || !type) return res.status(400).json({ error: 'prompt and type required' });
  try {
    const q = await prisma.question.create({
      data: {
        prompt,
        type,
        options: options ?? null,
        answer: answer ?? null,
        hints: Array.isArray(hints) ? hints : [],
        listId,
      },
    });
    res.status(201).json(q);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
