import { randomUUID } from 'crypto';
import { prisma } from '../config/database.js';
import { getEduAiChatUrl } from './eduaiClient.js';

/**
 * Call UBC eduAI API to generate guidance
 * Calls eduAI's /chat endpoint with non-streaming, chat-aware payload.
 * @param {object} options
 * @param {string} options.systemPrompt - Composed system prompt
 * @param {string} options.userMessage - Constructed user message
 * @param {string|null} options.modelId - Optional model ID override (format: "provider:model")
 * @param {string} options.userApiKey - User-provided API key for the model provider
 * @param {string|null} options.chatId - Optional existing chat id for history
 * @param {string|null} options.messageId - Optional client-generated message id
 * @param {object|null} options.proxyUser - Optional proxy user envelope for eduAI
 * @param {string|null} options.courseCode - Optional course code for RAG
 * @returns {Promise<{ message: string, chatId: string | null }>}
 */
async function callEduAI({
  systemPrompt,
  userMessage,
  modelId = null,
  userApiKey,
  chatId = null,
  messageId = null,
  proxyUser = null,
  courseCode = null,
}) {
  const apiKey = process.env.EDUAI_API_KEY;
  const endpoint = getEduAiChatUrl();
  const model = modelId || process.env.EDUAI_MODEL || 'google:gemini-2.5-flash';

  if (!apiKey) {
    console.error('[aiGuidance] Missing EDUAI_API_KEY in environment variables');
    throw new Error('AI API configuration missing');
  }

  if (!userApiKey) {
    console.error('[aiGuidance] Missing user API key');
    throw new Error('API key is required');
  }

  // Extract provider from model ID (e.g., "google:gemini-2.5-flash" -> "google")
  const [provider] = model.split(':');
  if (!provider) {
    console.error('[aiGuidance] Invalid model ID format:', model);
    throw new Error('Invalid model ID format');
  }

  const userMessageId = messageId || randomUUID();

  // Build apiKeys object dynamically based on provider
  const apiKeys = {
    [provider]: {
      apiKey: userApiKey,
      isEnabled: true,
    },
  };

  const requestBody = {
    messages: [
      {
        id: userMessageId,
        role: 'user',
        content: userMessage,
      },
    ],
    systemPrompt,
    model,
    apiKeys,
    streaming: false,
    ...(chatId ? { chatId } : {}),
    ...(proxyUser ? { proxyUser } : {}),
    ...(courseCode ? { courseCode } : {}),
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

    if (data.content && typeof data.content === 'string') {
      return {
        message: data.content,
        chatId: data.chatId || chatId || null,
      };
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
  return `${topicText}Student request: ${message}`;
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

  base += `\n\nStudent request: ${message}`;

  return base;
}

async function getPromptTemplateBySlug(slug) {
  return prisma.promptTemplate.findUnique({ where: { slug } });
}

export async function generateTeachResponse({
  activity,
  topicName,
  knowledgeLevel,
  message,
  modelId = null,
  apiKey,
  chatId = null,
  messageId = null,
  proxyUser = null,
  courseCode = null,
}) {
  try {
    const template = await getPromptTemplateBySlug('learning-prompt');
    if (!template) {
      throw new Error('Learning prompt template missing');
    }

    const systemPrompt = buildSystemPrompt(template.systemPrompt, {
      topic: topicName || activity.mainTopic?.name || 'the subject',
      knowledgeLevel,
    });

    const userMessage = buildTeachUserMessage({ topicName: topicName || activity.mainTopic?.name, message });

    return await callEduAI({
      systemPrompt,
      userMessage,
      modelId,
      userApiKey: apiKey,
      chatId,
      messageId,
      proxyUser,
      courseCode,
    });
  } catch (error) {
    console.error('[aiGuidance] Failed to generate teach response:', error);
    return { message: 'AI study buddy not available right now. Please try again later.', chatId };
  }
}

export async function generateGuideResponse({
  activity,
  knowledgeLevel,
  message,
  studentAnswer,
  modelId = null,
  apiKey,
  chatId = null,
  messageId = null,
  proxyUser = null,
  courseCode = null,
}) {
  try {
    const template = await getPromptTemplateBySlug('exercise-prompt');
    if (!template) {
      throw new Error('Exercise prompt template missing');
    }

    const systemPrompt = buildSystemPrompt(template.systemPrompt, {
      topic: activity.mainTopic?.name || 'the subject',
      knowledgeLevel,
    });

    const userMessage = buildGuideUserMessage(activity, { message, studentAnswer });

    return await callEduAI({
      systemPrompt,
      userMessage,
      modelId,
      userApiKey: apiKey,
      chatId,
      messageId,
      proxyUser,
      courseCode,
    });
  } catch (error) {
    console.error('[aiGuidance] Failed to generate guide response:', error);
    return { message: 'AI study buddy not available right now. Please try again later.', chatId };
  }
}

/**
 * Generate a response using the instructor's custom prompt
 * Uses the activity's customPrompt field as the system prompt
 */
export async function generateCustomResponse({
  activity,
  topicName,
  knowledgeLevel,
  message,
  studentAnswer,
  modelId = null,
  apiKey,
  chatId = null,
  messageId = null,
  proxyUser = null,
  courseCode = null,
}) {
  try {
    if (!activity.customPrompt) {
      throw new Error('No custom prompt configured for this activity');
    }

    // Use the instructor's custom prompt, applying placeholders if present
    const systemPrompt = buildSystemPrompt(activity.customPrompt, {
      topic: topicName || activity.mainTopic?.name || 'the subject',
      knowledgeLevel,
    });

    // Include student answer context like guide mode
    const userMessage = buildGuideUserMessage(activity, { message, studentAnswer });

    return await callEduAI({
      systemPrompt,
      userMessage,
      modelId,
      userApiKey: apiKey,
      chatId,
      messageId,
      proxyUser,
      courseCode,
    });
  } catch (error) {
    console.error('[aiGuidance] Failed to generate custom response:', error);
    return { message: 'AI study buddy not available right now. Please try again later.', chatId };
  }
}
