import { prisma } from '../config/database.js';
import { getEduAiChatUrl } from './eduaiClient.js';

/**
 * Call UBC eduAI API to generate guidance
 * @param {string} systemPrompt - Composed system prompt
 * @param {string} userMessage - Constructed user message
 * @returns {Promise<string>} - AI-generated guidance text
 */
async function callEduAI(systemPrompt, userMessage) {
  const apiKey = process.env.EDUAI_API_KEY;
  const googleApiKey = process.env.EDUAI_GOOGLE_API_KEY;
  const endpoint = getEduAiChatUrl();
  const model = process.env.EDUAI_MODEL || 'google:gemini-2.5-flash';

  if (!apiKey || !googleApiKey) {
    console.error('[aiGuidance] Missing API keys in environment variables');
    throw new Error('AI API configuration missing');
  }

  // Combine system prompt with user message since eduAI doesn't support separate system role
  const combinedMessage = `${systemPrompt}\n\n${userMessage}`;

  const requestBody = {
    messages: [
      {
        role: 'user',
        content: combinedMessage,
      },
    ],
    model,
    apiKeys: {
      google: {
        apiKey: googleApiKey,
        isEnabled: true,
      },
    },
    streaming: false,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[aiGuidance] API error:', response.status, errorText);
      throw new Error(`AI API returned status ${response.status}`);
    }

    const data = await response.json();

    // Extract content from response
    if (data.content && typeof data.content === 'string') {
      return data.content;
    }

    console.error('[aiGuidance] Unexpected response format:', data);
    throw new Error('Invalid response format from AI API');
  } catch (error) {
    console.error('[aiGuidance] Error calling eduAI:', error);
    throw error;
  }
}

/**
 * Build system prompt using provided template and context
 */
function buildSystemPrompt(templateContent, context = {}) {
  let systemPrompt = templateContent || 'You are a helpful teaching assistant who guides students toward understanding without revealing answers directly.';

  if (context.topic) {
    systemPrompt = systemPrompt.replace(/\[INSERT TOPIC HERE\]/g, context.topic);
    systemPrompt = systemPrompt.replace(/\[ENTER TOPIC\]/g, context.topic);
  }

  if (context.knowledgeLevel) {
    systemPrompt = systemPrompt.replace(/\[ENTER KNOWLEDGE LEVEL\]/g, context.knowledgeLevel);
  }

  return systemPrompt;
}

function buildTeachUserMessage({ topicName, message }) {
  const topicText = topicName ? `Topic: ${topicName}\n\n` : '';
  return `${topicText}Student request: ${message}\n\nExplain the concept at the requested knowledge level using clear language, analogies, and progressive depth. Avoid giving code unless asked.`;
}

function buildGuideUserMessage(activity, { message, studentAnswer }) {
  const config = activity.config || {};
  const questionType = config.questionType || 'MCQ';
  const question = config.question || activity.instructionsMd || 'No question text provided.';

  let base = `Question: ${question}`;

  if (questionType === 'MCQ') {
    const options = Array.isArray(config.options)
      ? config.options
      : (config.options && Array.isArray(config.options.choices) ? config.options.choices : []);
    if (options.length > 0) {
      base += '\n\nOptions:\n';
      options.forEach((option, idx) => {
        const letter = String.fromCharCode(65 + idx);
        base += `${letter}. ${option}\n`;
      });
    }
  }

  if (studentAnswer !== null && studentAnswer !== undefined && String(studentAnswer).length > 0) {
    const answerText = typeof studentAnswer === 'number'
      ? String.fromCharCode(65 + studentAnswer)
      : String(studentAnswer);
    base += `\n\nStudent answer: ${answerText}`;
  }

  base += `\n\nStudent request: ${message}\n\nRespond with hints that encourage problem solving. Ask guiding questions, reference relevant concepts, and avoid giving the exact solution.`;

  return base;
}

async function getPromptTemplateById(templateId) {
  return prisma.promptTemplate.findUnique({ where: { id: templateId } });
}

export async function generateTeachResponse({ activity, topicName, knowledgeLevel, message }) {
  try {
    const template = await getPromptTemplateById(35);
    if (!template) {
      throw new Error('Learning prompt template missing');
    }

    const systemPrompt = buildSystemPrompt(template.systemPrompt, {
      topic: topicName || activity.mainTopic?.name || 'the subject',
      knowledgeLevel,
    });

    const userMessage = buildTeachUserMessage({ topicName: topicName || activity.mainTopic?.name, message });

    return await callEduAI(systemPrompt, userMessage);
  } catch (error) {
    console.error('[aiGuidance] Failed to generate teach response:', error);
    return 'AI study buddy not available right now. Please try again later.';
  }
}

export async function generateGuideResponse({ activity, knowledgeLevel, message, studentAnswer }) {
  try {
    const template = await getPromptTemplateById(36);
    if (!template) {
      throw new Error('Exercise prompt template missing');
    }

    const systemPrompt = buildSystemPrompt(template.systemPrompt, {
      topic: activity.mainTopic?.name || 'the subject',
      knowledgeLevel,
    });

    const userMessage = buildGuideUserMessage(activity, { message, studentAnswer });

    return await callEduAI(systemPrompt, userMessage);
  } catch (error) {
    console.error('[aiGuidance] Failed to generate guide response:', error);
    return 'AI study buddy not available right now. Please try again later.';
  }
}
