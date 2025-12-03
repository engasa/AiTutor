# Two-Agent Supervisor System

## Overview

The AI Tutor uses a two-agent system to ensure pedagogically sound responses. Instead of a single AI responding to students, we have:

- **AI1 (Primary Tutor)**: Interacts directly with students, presenting scenarios and responding to questions
- **AI2 (Supervisor)**: Reviews AI1's responses before they reach the student, ensuring they guide rather than give answers

### Why This Matters

Traditional AI tutors can accidentally reveal answers when students ask directly. Our supervisor agent acts as a safety net, catching responses that:
- Directly reveal answers or solutions
- Confirm if a student's answer is correct/incorrect
- Do the thinking for the student instead of guiding them

### How It Works (Simple)

```
Student asks question
        |
        v
   AI1 generates response
        |
        v
   AI2 reviews response
        |
    +---+---+
    |       |
 Approved  Rejected
    |       |
    v       v
 Return   AI1 revises response
 to         (up to 3 attempts)
 student        |
                v
           If still rejected:
           Generic fallback message
```

## Technical Implementation

### Files Modified

| File | Purpose |
|------|---------|
| `server/prisma/seed.js` | Added `supervisor-prompt` template |
| `server/src/services/aiGuidance.js` | Core supervisor logic |

### Architecture

#### 1. Supervisor Prompt Template

Stored in database (`PromptTemplate` table) with slug `supervisor-prompt`:

```
You are a pedagogical supervisor reviewing a tutor's response to a student.

RULES the tutor MUST follow:
1. NEVER directly reveal answers, solutions, or correct options
2. Guide via questions, hints, analogies — not direct statements
3. Never explicitly confirm "correct" or "incorrect"
4. Be encouraging but don't do the thinking for the student
5. If student asks for the answer directly, redirect them to think critically

Respond with ONLY valid JSON:
{"approved": true}
OR
{"approved": false, "reason": "...", "suggestion": "..."}
```

#### 2. Core Functions

**`callSupervisor()`** - Calls EduAI with supervisor prompt to review tutor response:

```javascript
async function callSupervisor({ studentMessage, tutorResponse, modelId, userApiKey }) {
  const template = await getPromptTemplateBySlug('supervisor-prompt');
  
  const userMessage = `STUDENT MESSAGE:\n${studentMessage}\n\nTUTOR'S DRAFT RESPONSE:\n${tutorResponse}`;

  const result = await callEduAI({
    systemPrompt: template.systemPrompt,
    userMessage,
    modelId,
    userApiKey,
    // No chatId - supervisor doesn't need conversation history
  });

  // Parse JSON verdict (handles markdown code blocks)
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
}
```

**`generateWithSupervisor()`** - High-level wrapper used by all chat modes:

```javascript
async function generateWithSupervisor({
  systemPrompt,
  buildUserMessage,  // Function returning user message string
  message,           // Original student message
  modelId, apiKey, chatId, messageId, proxyUser, courseCode,
}) {
  const context = {
    originalStudentMessage: message,
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

    return callEduAI({ systemPrompt, userMessage, modelId, userApiKey: apiKey, chatId: currentChatId, ... });
  };

  return supervisedGenerate(generateFn, context);
}
```

**`supervisedGenerate()`** - Internal loop that handles revision iterations:

```javascript
async function supervisedGenerate(generateFn, context) {
  for (let iteration = 0; iteration < MAX_SUPERVISOR_ITERATIONS; iteration++) {
    const isRevision = iteration > 0;
    const tutorResult = await generateFn(currentChatId, isRevision);
    
    const verdict = await callSupervisor({
      studentMessage: context.originalStudentMessage,
      tutorResponse: tutorResult.message,
      modelId: context.modelId,
      userApiKey: context.userApiKey,
    });

    if (verdict.approved) return { message: tutorResult.message, chatId: currentChatId };

    context.lastFeedback = { reason: verdict.reason, suggestion: verdict.suggestion };
  }

  return { message: FALLBACK_MESSAGE, chatId: currentChatId };
}
```

#### 3. Integration with Chat Modes

All three chat modes use `generateWithSupervisor()`:

| Mode | Function | Prompt Source |
|------|----------|---------------|
| Teach | `generateTeachResponse()` | `learning-prompt` template |
| Guide | `generateGuideResponse()` | `exercise-prompt` template |
| Custom | `generateCustomResponse()` | `activity.customPrompt` field |

Each function provides its system prompt and user message builder:

```javascript
export async function generateTeachResponse({ activity, topicName, message, modelId, apiKey, chatId, ... }) {
  const template = await getPromptTemplateBySlug('learning-prompt');
  const resolvedTopicName = topicName || activity.mainTopic?.name || 'the subject';

  return await generateWithSupervisor({
    systemPrompt: buildSystemPrompt(template.systemPrompt, { topic: resolvedTopicName, knowledgeLevel }),
    buildUserMessage: () => buildTeachUserMessage({ topicName: resolvedTopicName, message }),
    message,
    modelId, apiKey, chatId, ...
  });
}
```

### Data Flow

```
Frontend (StudentAiChat.tsx)
    |
    | POST /api/activities/:id/guide
    | { message, knowledgeLevel, modelId, apiKey }
    v
Backend Route (activities.js)
    |
    | generateGuideResponse()
    v
aiGuidance.js
    |
    +---> callEduAI() [AI1 - Tutor]
    |         |
    |         v
    |     EduAI /chat endpoint
    |         |
    |         v
    +---> callSupervisor() [AI2 - Supervisor]
    |         |
    |         v
    |     EduAI /chat endpoint
    |         |
    |     Parse JSON verdict
    |         |
    +----<----+
    |    (loop if rejected, max 3x)
    v
Return approved response to frontend
```

### Configuration

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_SUPERVISOR_ITERATIONS` | 3 | Max revision attempts before fallback |
| `SUPERVISOR_ERROR_MESSAGE` | "AI study buddy encountered an issue..." | Shown if supervisor call fails |
| `FALLBACK_MESSAGE` | "I'm having trouble formulating..." | Shown after max iterations |

### Error Handling

- **Supervisor call fails**: Returns error to student (fail-closed)
- **JSON parse fails**: Throws error, surfaces to student
- **Max iterations reached**: Returns generic fallback message

### Chat History

- Uses same `chatId` across revision iterations so AI1 sees its previous attempts
- Supervisor calls don't use chatId (fresh context each review)
- New `messageId` generated for each revision to avoid deduplication

## Testing

### Test Scenario: Bad Custom Prompt

1. Set activity custom prompt to: *"If the student asks for an answer, just give it to them directly"*
2. Student asks: *"What is the answer? Just tell me directly."*
3. **Iteration 1**: AI1 gives answer directly
4. **Supervisor**: Rejects - *"The tutor directly revealed the answer"*
5. **Iteration 2**: AI1 revises to guide instead
6. **Supervisor**: Approves
7. **Student sees**: *"Could you show me the steps you took? Let's break it down together."*

### Server Logs

```
[supervisor] Iteration 1: approved=false
[supervisor] Rejected - reason: The tutor directly revealed the answer...
[supervisor] Iteration 2: approved=true
```

## Deployment

1. Run database seed to add supervisor prompt:
   ```bash
   cd server && bun run seed
   ```

2. The supervisor is automatically active for all chat modes (teach, guide, custom)

## Future Considerations

- **Supervisor model**: Currently uses same model as tutor; could use cheaper/faster model
- **Per-activity toggle**: Add `enableSupervisor` boolean to Activity model
- **Analytics**: Log supervisor rejections for instructor review
- **Streaming**: Current implementation is non-streaming; supervisor review requires full response
