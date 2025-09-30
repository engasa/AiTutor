import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { toPublicUser } from '../utils/mappers.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const AUTH_COOKIE_NAME = 'aitutor_auth_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
};

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: '24h',
    });

    res.cookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json({ token, user: toPublicUser(user) });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/me', async (req, res) => {
  const authUser = req.user;
  res.json({ user: toPublicUser(authUser) });
});

router.post('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: 0 });
  res.json({ ok: true });
});

export default router;
