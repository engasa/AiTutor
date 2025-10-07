import { prisma } from '../config/database.js';

/**
 * Compose the system prompt by combining base prompt + activity-specific prompt template
 * @param {Object} activity - Activity with optional promptTemplate included
 * @returns {Promise<string>} - Combined system prompt
 */
async function composeSystemPrompt(activity) {
  // Fetch base system prompt
  const basePrompt = await prisma.systemPrompt.findUnique({
    where: { slug: 'global-activity-base' },
  });

  let systemPrompt = basePrompt?.content || 'You are a helpful teaching assistant who guides students toward understanding without revealing answers directly.';

  // If activity has a prompt template, append its system prompt
  if (activity.promptTemplate?.systemPrompt) {
    systemPrompt += '\n\n' + activity.promptTemplate.systemPrompt;
  }

  return systemPrompt;
}

/**
 * Construct the user message based on activity type and student's answer
 * @param {Object} activity - Activity with config containing question, type, options, answer
 * @param {string|number|null} studentAnswer - Student's current/previous answer
 * @returns {string} - Formatted user message for AI
 */
function constructUserMessage(activity, studentAnswer = null) {
  const config = activity.config || {};
  const questionType = config.questionType || 'MCQ';
  const question = config.question || activity.instructionsMd || 'No question text provided.';

  if (questionType === 'MCQ') {
    return constructMCQMessage(question, config, studentAnswer);
  } else if (questionType === 'SHORT_TEXT') {
    return constructShortTextMessage(question, config, studentAnswer);
  }

  // Fallback for unknown types
  return `Question: ${question}\n\nPlease provide guidance for this question.`;
}

/**
 * Construct MCQ-specific guidance message
 * @private
 */
function constructMCQMessage(question, config, studentAnswer) {
  const options = config.options || [];
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
  const endpoint = process.env.EDUAI_ENDPOINT || 'https://eduai.ok.ubc.ca/api/chat';
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
 * @param {Object} activity - Activity object with promptTemplate relation included
 * @param {string|number|null} studentAnswer - Optional student answer for context
 * @returns {Promise<string>} - AI-generated guidance message
 */
export async function generateGuidance(activity, studentAnswer = null) {
  try {
    // Compose system prompt
    const systemPrompt = await composeSystemPrompt(activity);

    // Construct user message
    const userMessage = constructUserMessage(activity, studentAnswer);

    console.log('[aiGuidance] Requesting guidance for activity', activity.id);

    // Call AI API
    const aiResponse = await callEduAI(systemPrompt, userMessage);

    return aiResponse;
  } catch (error) {
    console.error('[aiGuidance] Failed to generate guidance:', error);
    // Return fallback message on any error
    return 'AI study buddy not available right now. Please try again later.';
  }
}
