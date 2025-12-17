import express from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  SYSTEM_SETTING_KEYS,
  clearSystemSetting,
  getEduAiApiKeyStatus,
  setSystemSetting,
} from '../services/systemSettings.js';

const router = express.Router();

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

