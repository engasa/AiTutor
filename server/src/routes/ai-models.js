import express from 'express';
import { prisma } from '../config/database.js';

const router = express.Router();

router.get('/ai-models', async (req, res) => {
  try {
    const models = await prisma.aiModel.findMany({
      orderBy: { modelName: 'asc' },
      select: {
        id: true,
        modelId: true,
        modelName: true,
      },
    });
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load AI models', detail: String(error) });
  }
});

export default router;
