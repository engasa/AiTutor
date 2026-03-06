import express from 'express';
import { prisma } from '../config/database.js';
import { requireRole } from '../middleware/auth.js';
import {
  SYSTEM_SETTING_KEYS,
  clearSystemSetting,
  getEduAiApiKeyStatus,
  setSystemSetting,
} from '../services/systemSettings.js';
import { mapAdminUser } from '../utils/mappers.js';

const router = express.Router();

router.get('/admin/users', requireRole('ADMIN'), async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    res.json(users.map(mapAdminUser));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.patch('/admin/users/:userId/role', requireRole('ADMIN'), async (req, res) => {
  const userId = Number(req.params.userId);
  const nextRole = req.body?.role;

  if (!Number.isFinite(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  if (nextRole !== 'INSTRUCTOR' && nextRole !== 'ADMIN') {
    return res.status(400).json({ error: 'role must be INSTRUCTOR or ADMIN' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'STUDENT') {
      return res.status(400).json({ error: 'Only students can be promoted in this phase' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: nextRole },
    });

    res.json(mapAdminUser(updated));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/admin/settings/eduai-api-key', requireRole('ADMIN'), async (req, res) => {
  try {
    const status = await getEduAiApiKeyStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.put('/admin/settings/eduai-api-key', requireRole('ADMIN'), async (req, res) => {
  const apiKey = req.body?.apiKey;
  if (typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'apiKey must be a string' });
  }

  const trimmed = apiKey.trim();
  if (!trimmed) {
    return res.status(400).json({ error: 'apiKey cannot be empty' });
  }

  try {
    await setSystemSetting(SYSTEM_SETTING_KEYS.EDUAI_API_KEY, trimmed);
    const status = await getEduAiApiKeyStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete('/admin/settings/eduai-api-key', requireRole('ADMIN'), async (req, res) => {
  try {
    await clearSystemSetting(SYSTEM_SETTING_KEYS.EDUAI_API_KEY);
    const status = await getEduAiApiKeyStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
