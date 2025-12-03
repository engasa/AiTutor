import { randomUUID } from 'crypto';
import { prisma } from '../config/database.js';
import { getEduAiChatUrl } from './eduaiClient.js';

// =============================================================================
// SUPERVISOR CONFIGURATION
// =============================================================================

const SUPERVISOR_ENABLED = process.env.AI_SUPERVISOR_ENABLED !== 'false';
const MAX_SUPERVISOR_ITERATIONS = 3;
const SUPERVISOR_ERROR_MESSAGE = 'AI study buddy encountered an issue reviewing the response. Please try again.';
const FALLBACK_MESSAGE = "I'm having trouble formulating a helpful response right now. Please try rephrasing your question, or ask your instructor for guidance.";

// =============================================================================
// EDUAI API COMMUNICATION
// =============================================================================

/**
 * Call EduAI API to generate a response.
 * Handles authentication, request formatting, and response parsing.
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

  const apiKeys = {
    [provider]: {
      apiKey: userApiKey,
      isEnabled: true,
    },
  };

  const requestBody = {
    messages: [{ id: userMessageId, role: 'user', content: userMessage }],
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

// =============================================================================
// TWO-AGENT SUPERVISOR SYSTEM
// =============================================================================

/**
 * Call supervisor (AI2) to review tutor's response.
 * Returns approval verdict with reason/suggestion if rejected.
 */
async function callSupervisor({ studentMessage, studentContext, tutorResponse, modelId, userApiKey }) {
  const template = await getPromptTemplateBySlug('supervisor-prompt');
  if (!template) {
    throw new Error('Supervisor prompt template not configured');
  }

  const userMessage = `STUDENT MESSAGE:
${studentMessage}

CONTEXT (QUESTION / OPTIONS / KNOWLEDGE):
${studentContext || 'Not provided'}

TUTOR'S DRAFT RESPONSE:
${tutorResponse}`;

  const result = await callEduAI({
    systemPrompt: template.systemPrompt,
    userMessage,
    modelId,
    userApiKey,
    chatId: null,
    messageId: null,
    proxyUser: null,
    courseCode: null,
  });

  // Parse JSON verdict - fail-open on parse errors (approve tutor's draft)
  try {
    let jsonStr = result.message.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    const verdict = JSON.parse(jsonStr);
    return {
      approved: Boolean(verdict.approved),
      reason: verdict.reason || '',
      suggestion: verdict.suggestion || '',
    };
  } catch (parseError) {
    console.error('[supervisor] Failed to parse verdict (fail-open):', result.message, parseError);
    return { approved: true, reason: '', suggestion: '', parseError: true };
  }
}

/**
 * Wrap tutor generation with supervisor review loop.
 * AI1 generates, AI2 reviews, retry up to MAX_SUPERVISOR_ITERATIONS if rejected.
 */
async function supervisedGenerate(generateFn, context) {
  const { originalStudentMessage, studentContext, modelId, userApiKey } = context;
  let currentChatId = context.chatId;

  if (!SUPERVISOR_ENABLED) {
    return generateFn(currentChatId || null, false);
  }

  for (let iteration = 0; iteration < MAX_SUPERVISOR_ITERATIONS; iteration++) {
    const isRevision = iteration > 0;
    const tutorResult = await generateFn(currentChatId, isRevision);
    currentChatId = tutorResult.chatId || currentChatId;

    try {
      const verdict = await callSupervisor({
        studentMessage: originalStudentMessage,
        studentContext,
        tutorResponse: tutorResult.message,
        modelId,
        userApiKey,
      });

      console.log(`[supervisor] Iteration ${iteration + 1}: approved=${verdict.approved}`);
      if (verdict.approved) {
        return { message: tutorResult.message, chatId: currentChatId };
      }

      console.log(`[supervisor] Rejected - reason: ${verdict.reason}, suggestion: ${verdict.suggestion}`);
      context.lastFeedback = {
        reason: verdict.reason,
        suggestion: verdict.suggestion,
      };
    } catch (supervisorError) {
      console.error('[supervisor] Error during review:', supervisorError);
      throw new Error(SUPERVISOR_ERROR_MESSAGE);
    }
  }

  console.warn('[supervisor] Max iterations reached, returning fallback');
  return { message: FALLBACK_MESSAGE, chatId: currentChatId };
}

/**
 * Core generation with supervisor - shared by all modes.
 * Handles context setup, revision logic, and EduAI calls.
 */
async function generateWithSupervisor({
  systemPrompt,
  buildUserMessage,
  message,
  supervisorContext,
  modelId,
  apiKey,
  chatId,
  messageId,
  proxyUser,
  courseCode,
}) {
  const context = {
    originalStudentMessage: message,
    studentContext: supervisorContext || buildUserMessage(),
    modelId,
    userApiKey: apiKey,
    chatId,
    lastFeedback: null,
  };

  const generateFn = async (currentChatId, isRevision) => {
    let userMessage = buildUserMessage();
    
    // Prepend supervisor feedback on revision attempts
    if (isRevision && context.lastFeedback) {
      userMessage = `[REVISION NEEDED: ${context.lastFeedback.reason}. Suggestion: ${context.lastFeedback.suggestion}. Guide without revealing answers.]\n\n` + userMessage;
    }

    return callEduAI({
      systemPrompt,
      userMessage,
      modelId,
      userApiKey: apiKey,
      chatId: currentChatId,
      messageId: isRevision ? randomUUID() : messageId,
      proxyUser,
      courseCode,
    });
  };

  return supervisedGenerate(generateFn, context);
}

// =============================================================================
// PROMPT BUILDING UTILITIES
// =============================================================================

/** Replace template placeholders with context values. */
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

/** Build user message for teach mode. */
function buildTeachUserMessage({ topicName, message }) {
  const topicText = topicName ? `Topic: ${topicName}\n\n` : '';
  return `${topicText}Student request: ${message}`;
}

/** Build user message for guide/custom mode with question context. */
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

/** Fetch prompt template from database by slug. */
async function getPromptTemplateBySlug(slug) {
  return prisma.promptTemplate.findUnique({ where: { slug } });
}

// =============================================================================
// PUBLIC API - RESPONSE GENERATORS
// =============================================================================

/**
 * Generate response for "Teach me" mode.
 * Uses 'learning-prompt' template, wrapped with supervisor review.
 */
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

    const resolvedTopicName = topicName || activity.mainTopic?.name || 'the subject';
    const baseUserMessage = buildTeachUserMessage({ topicName: resolvedTopicName, message });
    const supervisorContext = `${baseUserMessage}\n\nKnowledge level: ${knowledgeLevel}`;

    return await generateWithSupervisor({
      systemPrompt: buildSystemPrompt(template.systemPrompt, { topic: resolvedTopicName, knowledgeLevel }),
      buildUserMessage: () => baseUserMessage,
      supervisorContext,
      message,
      modelId,
      apiKey,
      chatId,
      messageId,
      proxyUser,
      courseCode,
    });
  } catch (error) {
    console.error('[aiGuidance] Failed to generate teach response:', error);
    return { message: error.message || 'AI study buddy not available right now. Please try again later.', chatId };
  }
}

/**
 * Generate response for "Guide me" mode.
 * Uses 'exercise-prompt' template, wrapped with supervisor review.
 */
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

    const baseUserMessage = buildGuideUserMessage(activity, { message, studentAnswer });
    const supervisorContext = `${baseUserMessage}\n\nKnowledge level: ${knowledgeLevel}`;

    return await generateWithSupervisor({
      systemPrompt: buildSystemPrompt(template.systemPrompt, { topic: activity.mainTopic?.name || 'the subject', knowledgeLevel }),
      buildUserMessage: () => baseUserMessage,
      supervisorContext,
      message,
      modelId,
      apiKey,
      chatId,
      messageId,
      proxyUser,
      courseCode,
    });
  } catch (error) {
    console.error('[aiGuidance] Failed to generate guide response:', error);
    return { message: error.message || 'AI study buddy not available right now. Please try again later.', chatId };
  }
}

/**
 * Generate response using instructor's custom prompt.
 * Uses activity.customPrompt as system prompt, wrapped with supervisor review.
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

    const resolvedTopicName = topicName || activity.mainTopic?.name || 'the subject';
    const baseUserMessage = buildGuideUserMessage(activity, { message, studentAnswer });
    const supervisorContext = `${baseUserMessage}\n\nKnowledge level: ${knowledgeLevel}`;

    return await generateWithSupervisor({
      systemPrompt: buildSystemPrompt(activity.customPrompt, { topic: resolvedTopicName, knowledgeLevel }),
      buildUserMessage: () => baseUserMessage,
      supervisorContext,
      message,
      modelId,
      apiKey,
      chatId,
      messageId,
      proxyUser,
      courseCode,
    });
  } catch (error) {
    console.error('[aiGuidance] Failed to generate custom response:', error);
    return { message: error.message || 'AI study buddy not available right now. Please try again later.', chatId };
  }
}
