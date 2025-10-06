import express from 'express';
import { prisma } from '../config/database.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/prompts', requireRole('INSTRUCTOR'), async (req, res) => {
  try {
    const prompts = await prisma.promptTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    res.json(prompts);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/prompts', requireRole('INSTRUCTOR'), async (req, res) => {
  const {
    name,
    systemPrompt,
    userPrompt,
    temperature,
    topP,
  } = req.body || {};

  if (!name || !systemPrompt || !userPrompt) {
    return res.status(400).json({ error: 'name, systemPrompt, and userPrompt are required' });
  }

  try {
    const prompt = await prisma.promptTemplate.create({
      data: {
        name,
        systemPrompt,
        userPrompt,
        temperature: typeof temperature === 'number' ? temperature : null,
        topP: typeof topP === 'number' ? topP : null,
      },
    });
    res.status(201).json(prompt);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
