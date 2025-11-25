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

/**
 * Validate an API key by making a minimal request to the provider.
 * Uses lightweight endpoints (list models) that don't consume tokens.
 */
router.post('/ai-models/validate-key', async (req, res) => {
  const { provider, apiKey } = req.body;

  if (!provider || !apiKey) {
    return res.status(400).json({ valid: false, error: 'Missing provider or apiKey' });
  }

  try {
    if (provider === 'google') {
      // Gemini: list models endpoint is free/lightweight
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`
      );
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const message = body?.error?.message || 'Invalid API key';
        return res.status(400).json({ valid: false, error: message });
      }
    } else if (provider === 'openai') {
      // OpenAI: GET /models is free
      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const message = body?.error?.message || 'Invalid API key';
        return res.status(400).json({ valid: false, error: message });
      }
    } else {
      return res.status(400).json({ valid: false, error: `Unsupported provider: ${provider}` });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error('API key validation failed:', error);
    res.status(500).json({ valid: false, error: 'Validation request failed' });
  }
});

export default router;
