import express from 'express';
import { prisma } from '../config/database.js';

import { listEduAiModels } from '../services/eduaiClient.js';

const router = express.Router();

router.get('/ai-models', async (req, res) => {
  try {
    const eduAiModels = await listEduAiModels();
    
    const models = eduAiModels
      .filter(m => m.isActive)
      .map(m => ({
        id: m.id,
        modelId: `${m.provider.name}:${m.modelId}`,
        modelName: m.name,
      }))
      .sort((a, b) => a.modelName.localeCompare(b.modelName));

    res.json(models);
  } catch (error) {
    console.error('Failed to load AI models:', error);
    res.status(500).json({ error: 'Failed to load AI models', detail: String(error) });
  }
});

export default router;
