import express from 'express';
import { getAiModelPolicyState } from '../services/aiModelPolicy.js';

const router = express.Router();

router.get('/ai-models', async (req, res) => {
  try {
    const { policy, availableModels, availableModelsError } = await getAiModelPolicyState();

    if (availableModelsError) {
      return res
        .status(500)
        .json({ error: 'Failed to load AI models', detail: availableModelsError });
    }

    const visibleModels =
      req.user?.role === 'STUDENT'
        ? availableModels.filter((model) => policy.allowedTutorModelIds.includes(model.modelId))
        : availableModels;

    const models = visibleModels.map((model) => ({
      ...model,
      studentSelectable: policy.allowedTutorModelIds.includes(model.modelId),
      availability: policy.allowedTutorModelIds.includes(model.modelId) ? 'allowed' : 'admin-only',
    }));

    res.json(models);
  } catch (error) {
    console.error('Failed to load AI models:', error);
    res.status(500).json({ error: 'Failed to load AI models', detail: String(error) });
  }
});

/**
 * Validate an API key by making a minimal request to the provider.
 * Uses lightweight endpoints (list models) that don't consume tokens.
 *
 * Returns 200 with { valid: true/false, error? } so the client can read
 * provider-specific error messages. Only returns 4xx/5xx for actual request errors.
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
        `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`,
      );
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const message = body?.error?.message || 'Invalid API key';
        return res.json({ valid: false, error: message });
      }
    } else if (provider === 'openai') {
      // OpenAI: GET /models is free
      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const message = body?.error?.message || 'Invalid API key';
        return res.json({ valid: false, error: message });
      }
    } else {
      return res.json({ valid: false, error: `Unsupported provider: ${provider}` });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error('API key validation failed:', error);
    res.status(500).json({ valid: false, error: 'Validation request failed' });
  }
});

export default router;
