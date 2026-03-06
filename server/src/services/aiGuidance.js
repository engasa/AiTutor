import { randomUUID } from 'crypto';
import { prisma } from '../config/database.js';
import { getEduAiChatUrl } from './eduaiClient.js';
import { getEffectiveEduAiApiKey } from './systemSettings.js';

const SUPERVISOR_ERROR_MESSAGE = 'AI study buddy encountered an issue reviewing the response. Please try again.';
const FALLBACK_MESSAGE =
  "I'm having trouble formulating a helpful response right now. Please try rephrasing your question, or ask your instructor for guidance.";

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
  const apiKey = await getEffectiveEduAiApiKey();
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

async function getPromptTemplateBySlug(slug) {
  return prisma.promptTemplate.findUnique({ where: { slug } });
}

function stripMarkdownFence(rawText) {
  let value = rawText.trim();
  if (value.startsWith('```')) {
    value = value.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  }
  return value;
}

function normalizeSupervisorVerdict(verdict) {
  return {
    approved: Boolean(verdict.approved),
    reason: verdict.reason || '',
    feedbackToTutor:
      verdict.feedbackToTutor ||
      verdict.suggestion ||
      'Revise the response to stay more Socratic and avoid directly revealing the answer.',
    safeResponseToStudent:
      verdict.safeResponseToStudent ||
      'Let’s take one smaller step. Focus on the key concept behind the question and explain which part feels most uncertain.',
  };
}

async function callSupervisor({
  studentMessage,
  visibleContext,
  hiddenContext,
  tutorResponse,
  supervisorModelId,
  userApiKey,
}) {
  const template = await getPromptTemplateBySlug('supervisor-prompt');
  if (!template) {
    throw new Error('Supervisor prompt template not configured');
  }

  const buildUserMessage = (parseErrorDetails = null) => {
    const base = `VISIBLE STUDENT CONTEXT:
${visibleContext}

HIDDEN REVIEW CONTEXT (NOT FOR TUTOR):
${hiddenContext}

LATEST STUDENT MESSAGE:
${studentMessage}

TUTOR DRAFT RESPONSE:
${tutorResponse}`;

    if (!parseErrorDetails) return base;
    return `${base}

YOUR PREVIOUS RESPONSE WAS NOT VALID JSON.
PARSE ERROR: ${parseErrorDetails}
RESPOND WITH ONLY VALID JSON.`;
  };

  const attemptParse = async (parseErrorDetails = null) => {
    const result = await callEduAI({
      systemPrompt: template.systemPrompt,
      userMessage: buildUserMessage(parseErrorDetails),
      modelId: supervisorModelId,
      userApiKey,
    });

    try {
      const verdict = JSON.parse(stripMarkdownFence(result.message));
      return { ok: true, verdict: normalizeSupervisorVerdict(verdict), raw: result.message };
    } catch (parseError) {
      return { ok: false, parseError, raw: result.message };
    }
  };

  const first = await attemptParse();
  if (first.ok) {
    return { ...first.verdict, parseFailed: false, raw: first.raw };
  }

  const second = await attemptParse(first.parseError?.message || 'Invalid JSON');
  if (second.ok) {
    return { ...second.verdict, parseFailed: false, raw: second.raw };
  }

  console.error('[supervisor] Failed to parse verdict after retry:', second.raw, second.parseError);
  return {
    approved: false,
    reason: 'Supervisor response invalid after retry',
    feedbackToTutor: 'Revise the reply to avoid revealing the answer and stay focused on a single helpful hint.',
    safeResponseToStudent:
      'Let’s slow down and focus on one clue at a time. Think about which concept the question is really testing before choosing your next step.',
    parseFailed: true,
    raw: second.raw,
  };
}

function buildSystemPrompt(templateContent, context = {}) {
  let systemPrompt =
    templateContent ||
    'You are a helpful teaching assistant who guides students toward understanding without revealing answers directly.';

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
      : config.options && Array.isArray(config.options.choices)
      ? config.options.choices
      : [];

    if (options.length > 0) {
      base += '\n\nOptions:\n';
      options.forEach((option, idx) => {
        const letter = String.fromCharCode(65 + idx);
        base += `${letter}. ${option}\n`;
      });
    }
  }

  if (studentAnswer !== null && studentAnswer !== undefined && String(studentAnswer).length > 0) {
    const answerText =
      typeof studentAnswer === 'number'
        ? String.fromCharCode(65 + studentAnswer)
        : String(studentAnswer);
    base += `\n\nStudent answer: ${answerText}`;
  }

  base += `\n\nStudent request: ${message}`;
  return base;
}

function formatAnswerKey(activity, studentAnswer) {
  const config = activity.config || {};
  const questionType = config.questionType || 'MCQ';

  if (questionType === 'MCQ') {
    const correctIndex = config.answer?.correctIndex;
    const options = Array.isArray(config.options)
      ? config.options
      : config.options && Array.isArray(config.options.choices)
      ? config.options.choices
      : [];

    if (typeof correctIndex === 'number') {
      const label = String.fromCharCode(65 + correctIndex);
      const answerText = options[correctIndex] ? `${label}. ${options[correctIndex]}` : label;
      return `Correct answer: ${answerText}`;
    }
  }

  if (questionType === 'SHORT_TEXT' && typeof config.answer?.text === 'string' && config.answer.text.trim()) {
    return `Correct answer: ${config.answer.text.trim()}`;
  }

  if (studentAnswer !== null && studentAnswer !== undefined && String(studentAnswer).length > 0) {
    return `Student submitted answer: ${String(studentAnswer)}`;
  }

  return 'Correct answer: unavailable';
}

function buildTeachSupervisorContexts({ topicName, knowledgeLevel, message }) {
  const visibleContext = buildTeachUserMessage({ topicName, message });
  const hiddenContext = `${visibleContext}\n\nKnowledge level: ${knowledgeLevel}\n\nThis is a teaching exchange. The tutor should stay concise, encouraging, and avoid doing the student’s thinking for them.`;
  return { visibleContext, hiddenContext };
}

function buildGuideSupervisorContexts(activity, { knowledgeLevel, message, studentAnswer }) {
  const visibleContext = buildGuideUserMessage(activity, { message, studentAnswer });
  const hiddenContext = `${visibleContext}\n\nKnowledge level: ${knowledgeLevel}\n\nANSWER KEY FOR SUPERVISOR ONLY:\n${formatAnswerKey(
    activity,
    studentAnswer,
  )}`;
  return { visibleContext, hiddenContext };
}

async function supervisedGenerate(generateFn, context) {
  let currentChatId = context.chatId;
  const trace = {
    tutorModelId: context.tutorModelId,
    supervisorModelId: context.supervisorModelId,
    visibleContext: context.visibleContext,
    hiddenContext: context.hiddenContext,
    iterations: [],
    dualLoopEnabled: context.dualLoopEnabled,
    maxSupervisorIterations: context.maxSupervisorIterations,
  };

  if (!context.dualLoopEnabled) {
    const tutorResult = await generateFn(currentChatId || null, false);
    currentChatId = tutorResult.chatId || currentChatId;
    trace.iterations.push({
      iteration: 1,
      tutorDraft: tutorResult.message,
      supervisorVerdict: null,
    });
    return {
      message: tutorResult.message,
      chatId: currentChatId,
      trace: {
        ...trace,
        finalOutcome: 'single_pass',
        finalResponse: tutorResult.message,
        iterationCount: 1,
      },
    };
  }

  let lastSafeResponse = FALLBACK_MESSAGE;

  for (let iteration = 0; iteration < context.maxSupervisorIterations; iteration += 1) {
    const isRevision = iteration > 0;
    const tutorResult = await generateFn(currentChatId, isRevision, context.lastFeedback);
    currentChatId = tutorResult.chatId || currentChatId;

    const traceIteration = {
      iteration: iteration + 1,
      tutorDraft: tutorResult.message,
      supervisorVerdict: null,
    };

    try {
      const verdict = await callSupervisor({
        studentMessage: context.originalStudentMessage,
        visibleContext: context.visibleContext,
        hiddenContext: context.hiddenContext,
        tutorResponse: tutorResult.message,
        supervisorModelId: context.supervisorModelId,
        userApiKey: context.userApiKey,
      });

      traceIteration.supervisorVerdict = verdict;
      trace.iterations.push(traceIteration);
      lastSafeResponse = verdict.safeResponseToStudent || lastSafeResponse;

      if (verdict.approved) {
        return {
          message: tutorResult.message,
          chatId: currentChatId,
          trace: {
            ...trace,
            finalOutcome: 'approved',
            finalResponse: tutorResult.message,
            iterationCount: trace.iterations.length,
          },
        };
      }

      context.lastFeedback = verdict.feedbackToTutor;
    } catch (supervisorError) {
      console.error('[supervisor] Error during review:', supervisorError);
      throw new Error(SUPERVISOR_ERROR_MESSAGE);
    }
  }

  return {
    message: lastSafeResponse,
    chatId: currentChatId,
    trace: {
      ...trace,
      finalOutcome: 'safe_fallback',
      finalResponse: lastSafeResponse,
      iterationCount: trace.iterations.length,
    },
  };
}

async function generateWithSupervisor({
  systemPrompt,
  buildUserMessage,
  originalStudentMessage,
  visibleContext,
  hiddenContext,
  tutorModelId,
  supervisorModelId,
  dualLoopEnabled,
  maxSupervisorIterations,
  apiKey,
  chatId,
  messageId,
  proxyUser,
  courseCode,
}) {
  const context = {
    originalStudentMessage,
    visibleContext,
    hiddenContext,
    tutorModelId,
    supervisorModelId,
    userApiKey: apiKey,
    chatId,
    dualLoopEnabled,
    maxSupervisorIterations,
    lastFeedback: null,
  };

  const generateFn = async (currentChatId, isRevision, lastFeedback) => {
    let userMessage = buildUserMessage();

    if (isRevision && lastFeedback) {
      userMessage = `[SUPERVISOR FEEDBACK: ${lastFeedback}]\n\n${userMessage}`;
    }

    return callEduAI({
      systemPrompt,
      userMessage,
      modelId: tutorModelId,
      userApiKey: apiKey,
      chatId: currentChatId,
      messageId: isRevision ? randomUUID() : messageId,
      proxyUser,
      courseCode,
    });
  };

  return supervisedGenerate(generateFn, context);
}

export async function generateTeachResponse({
  activity,
  topicName,
  knowledgeLevel,
  message,
  tutorModelId = null,
  supervisorModelId = null,
  dualLoopEnabled = true,
  maxSupervisorIterations = 3,
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
    const { visibleContext, hiddenContext } = buildTeachSupervisorContexts({
      topicName: resolvedTopicName,
      knowledgeLevel,
      message,
    });

    return generateWithSupervisor({
      systemPrompt: buildSystemPrompt(template.systemPrompt, {
        topic: resolvedTopicName,
        knowledgeLevel,
      }),
      buildUserMessage: () => baseUserMessage,
      originalStudentMessage: message,
      visibleContext,
      hiddenContext,
      tutorModelId,
      supervisorModelId,
      dualLoopEnabled,
      maxSupervisorIterations,
      apiKey,
      chatId,
      messageId,
      proxyUser,
      courseCode,
    });
  } catch (error) {
    console.error('[aiGuidance] Failed to generate teach response:', error);
    return {
      message: error.message || 'AI study buddy not available right now. Please try again later.',
      chatId,
      trace: {
        tutorModelId,
        supervisorModelId,
        iterations: [],
        finalOutcome: 'error',
        finalResponse:
          error.message || 'AI study buddy not available right now. Please try again later.',
        iterationCount: 0,
      },
    };
  }
}

export async function generateGuideResponse({
  activity,
  knowledgeLevel,
  message,
  studentAnswer,
  tutorModelId = null,
  supervisorModelId = null,
  dualLoopEnabled = true,
  maxSupervisorIterations = 3,
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
    const { visibleContext, hiddenContext } = buildGuideSupervisorContexts(activity, {
      knowledgeLevel,
      message,
      studentAnswer,
    });

    return generateWithSupervisor({
      systemPrompt: buildSystemPrompt(template.systemPrompt, {
        topic: activity.mainTopic?.name || 'the subject',
        knowledgeLevel,
      }),
      buildUserMessage: () => baseUserMessage,
      originalStudentMessage: message,
      visibleContext,
      hiddenContext,
      tutorModelId,
      supervisorModelId,
      dualLoopEnabled,
      maxSupervisorIterations,
      apiKey,
      chatId,
      messageId,
      proxyUser,
      courseCode,
    });
  } catch (error) {
    console.error('[aiGuidance] Failed to generate guide response:', error);
    return {
      message: error.message || 'AI study buddy not available right now. Please try again later.',
      chatId,
      trace: {
        tutorModelId,
        supervisorModelId,
        iterations: [],
        finalOutcome: 'error',
        finalResponse:
          error.message || 'AI study buddy not available right now. Please try again later.',
        iterationCount: 0,
      },
    };
  }
}

export async function generateCustomResponse({
  activity,
  topicName,
  knowledgeLevel,
  message,
  studentAnswer,
  tutorModelId = null,
  supervisorModelId = null,
  dualLoopEnabled = true,
  maxSupervisorIterations = 3,
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
    const { visibleContext, hiddenContext } = buildGuideSupervisorContexts(activity, {
      knowledgeLevel,
      message,
      studentAnswer,
    });

    return generateWithSupervisor({
      systemPrompt: buildSystemPrompt(activity.customPrompt, {
        topic: resolvedTopicName,
        knowledgeLevel,
      }),
      buildUserMessage: () => baseUserMessage,
      originalStudentMessage: message,
      visibleContext,
      hiddenContext,
      tutorModelId,
      supervisorModelId,
      dualLoopEnabled,
      maxSupervisorIterations,
      apiKey,
      chatId,
      messageId,
      proxyUser,
      courseCode,
    });
  } catch (error) {
    console.error('[aiGuidance] Failed to generate custom response:', error);
    return {
      message: error.message || 'AI study buddy not available right now. Please try again later.',
      chatId,
      trace: {
        tutorModelId,
        supervisorModelId,
        iterations: [],
        finalOutcome: 'error',
        finalResponse:
          error.message || 'AI study buddy not available right now. Please try again later.',
        iterationCount: 0,
      },
    };
  }
}
