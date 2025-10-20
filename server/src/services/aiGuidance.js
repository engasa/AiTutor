import { prisma } from '../config/database.js';
import { getEduAiChatUrl } from './eduaiClient.js';

/**
 * Replace placeholders in a prompt template with actual values
 * @param {string} template - Template string with placeholders
 * @param {Object} context - Context object with replacement values
 * @returns {string} - Template with placeholders replaced
 */
function replacePlaceholders(template, context) {
  let result = template;

  // Replace topic placeholders
  if (context.topic) {
    result = result.replace(/\[INSERT TOPIC HERE\]/g, context.topic);
    result = result.replace(/\[ENTER TOPIC\]/g, context.topic);
  }

  // Replace knowledge level placeholder
  if (context.knowledgeLevel) {
    result = result.replace(/\[ENTER KNOWLEDGE LEVEL\]/g, context.knowledgeLevel);
  }

  // Replace code snippet placeholder
  if (context.codeSnippet) {
    result = result.replace(/\[ENTER CODE HERE\]/g, context.codeSnippet);
  }

  return result;
}

/**
 * Compose the system prompt by combining base prompt + activity-specific prompt template
 * @param {Object} activity - Activity with optional promptTemplate included and mainTopic
 * @param {Object} context - Context with { topic, knowledgeLevel, codeSnippet }
 * @returns {Promise<string>} - Combined system prompt with placeholders replaced
 */
async function composeSystemPrompt(activity, context = {}, mode = 'guide') {
  // Fetch base system prompt
  const basePrompt = await prisma.systemPrompt.findUnique({
    where: { slug: 'global-activity-base' },
  });

  let systemPrompt = basePrompt?.content || 'You are a helpful teaching assistant who guides students toward understanding without revealing answers directly.';

  // If activity has a prompt template, append its system prompt
  if (activity.promptTemplate?.systemPrompt) {
    const templatePrompt = activity.promptTemplate.systemPrompt;
    // Replace placeholders in the prompt template
    const processedTemplate = replacePlaceholders(templatePrompt, context);
    systemPrompt += '\n\n' + processedTemplate;
  }

  // Mode-specific nudge
  if (mode === 'teach') {
    systemPrompt += '\n\nFocus on teaching the selected topic with step-by-step scaffolding and Socratic hints. Do not give full answers to assessment questions; emphasize understanding.';
  }

  return systemPrompt;
}

/**
 * Construct the user message based on activity type and student's answer
 * @param {Object} activity - Activity with config containing question, type, options, answer
 * @param {string|number|null} studentAnswer - Student's current/previous answer
 * @returns {string} - Formatted user message for AI
 */
function constructUserMessage(activity, studentAnswer = null, userMessage = null, mode = 'guide', topicName = null) {
  const config = activity.config || {};
  const questionType = config.questionType || 'MCQ';
  const question = config.question || activity.instructionsMd || 'No question text provided.';

  if (mode === 'teach') {
    let msg = `Teach me about: ${topicName || activity.mainTopic?.name || 'the subject'}.`;
    if (userMessage && String(userMessage).trim() !== '') {
      msg += `\n\nAdditional context: ${userMessage}`;
    }
    msg += '\n\nPlease explain concepts clearly, use examples, and ask probing questions to check understanding.';
    return msg;
  }

  if (questionType === 'MCQ') {
    let m = constructMCQMessage(question, config, studentAnswer);
    if (userMessage && String(userMessage).trim() !== '') {
      m += `\n\nStudent: ${userMessage}`;
    }
    return m;
  } else if (questionType === 'SHORT_TEXT') {
    let m = constructShortTextMessage(question, config, studentAnswer);
    if (userMessage && String(userMessage).trim() !== '') {
      m += `\n\nStudent: ${userMessage}`;
    }
    return m;
  }

  // Fallback for unknown types
  return `Question: ${question}\n\nPlease provide guidance for this question.`;
}

/**
 * Construct MCQ-specific guidance message
 * @private
 */
function constructMCQMessage(question, config, studentAnswer) {
  const options = Array.isArray(config.options)
    ? config.options
    : (config.options && Array.isArray(config.options.choices) ? config.options.choices : []);
  const correctIndex = config.answer?.correctIndex;

  let message = `Question: ${question}\n\nOptions:\n`;

  // Format options with A, B, C, D labels
  options.forEach((option, idx) => {
    const letter = String.fromCharCode(65 + idx); // A, B, C, D
    const isCorrect = idx === correctIndex ? ' ✓ (Correct)' : '';
    message += `${letter}. ${option}${isCorrect}\n`;
  });

  // Include student's answer if provided
  if (studentAnswer !== null && studentAnswer !== undefined) {
    const studentLetter = typeof studentAnswer === 'number'
      ? String.fromCharCode(65 + studentAnswer)
      : studentAnswer;
    const studentOptionText = typeof studentAnswer === 'number' && options[studentAnswer]
      ? ` (${options[studentAnswer]})`
      : '';
    message += `\nYour answer: ${studentLetter}${studentOptionText}`;
  }

  message += '\n\nPlease guide me toward the correct answer without revealing it directly. Offer hints, ask probing questions, or suggest concepts to review.';

  return message;
}

/**
 * Construct SHORT_TEXT-specific guidance message
 * @private
 */
function constructShortTextMessage(question, config, studentAnswer) {
  const expectedAnswer = config.answer?.text;

  let message = `Question: ${question}\n\n`;

  if (expectedAnswer) {
    message += `Expected answer: ${expectedAnswer}\n\n`;
  }

  if (studentAnswer !== null && studentAnswer !== undefined && String(studentAnswer).trim() !== '') {
    message += `Your answer: ${studentAnswer}\n\n`;
  }

  message += 'Please guide me toward the correct answer without revealing it directly. Offer hints, ask probing questions, or suggest concepts to review.';

  return message;
}

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
 * Main function: Generate AI guidance for an activity
 * @param {Object} activity - Activity object with promptTemplate relation included and mainTopic
 * @param {string|number|null} studentAnswer - Optional student answer for context
 * @param {string|null} knowledgeLevel - Student's knowledge level (e.g., "beginner", "intermediate", "advanced")
 * @param {string|null} codeSnippet - Optional code snippet for Exercise Prompt
 * @returns {Promise<string>} - AI-generated guidance message
 */
export async function generateGuidance(activity, studentAnswer = null, knowledgeLevel = null, codeSnippet = null, opts = {}) {
  try {
    const { mode = 'guide', topicName = null, userMessage = null } = opts || {};
    // Build context object for placeholder replacement
    const context = {
      topic: (mode === 'teach' && topicName) ? topicName : (activity.mainTopic?.name || 'the subject'),
      knowledgeLevel: knowledgeLevel || 'a university student',
      codeSnippet: codeSnippet || '',
    };

    // Compose system prompt with placeholder replacement
    const systemPrompt = await composeSystemPrompt(activity, context, mode);

    // Construct user message
    const composedUserMessage = constructUserMessage(activity, studentAnswer, userMessage, mode, context.topic);

    console.log('[aiGuidance] Requesting guidance for activity', activity.id, 'with context:', {
      topic: context.topic,
      knowledgeLevel: context.knowledgeLevel,
      hasCodeSnippet: !!context.codeSnippet,
    });

    // Call AI API
    const aiResponse = await callEduAI(systemPrompt, composedUserMessage);

    return aiResponse;
  } catch (error) {
    console.error('[aiGuidance] Failed to generate guidance:', error);
    // Return fallback message on any error
    return 'AI study buddy not available right now. Please try again later.';
  }
}
