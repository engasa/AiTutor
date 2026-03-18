import { randomUUID } from 'crypto';
import express from 'express';
import { prisma } from '../config/database.js';
import { requireRole } from '../middleware/auth.js';
import { mapActivity } from '../utils/mappers.js';
import { evaluateQuestion } from '../services/activityEvaluation.js';
import { getActivityCompletionStatuses } from '../services/progressCalculation.js';
import {
  hasActivityFeedback,
  recordActivityFeedback,
  recordAiHelpRequest,
  recordSubmissionMetrics,
} from '../services/activityAnalytics.js';
import {
  resolveSupervisorSettings,
  resolveTutorModelSelection,
} from '../services/aiModelPolicy.js';
import {
  generateCustomResponse,
  generateGuideResponse,
  generateTeachResponse,
} from '../services/aiGuidance.js';
import { getEduAiAccessTokenForUser } from '../services/eduaiAuth.js';
import {
  ActivityFeedbackRequestSchema,
  CustomRequestSchema,
  GuideRequestSchema,
  TeachRequestSchema,
} from '../../../shared/schemas/aiGuidance.js';
import { CreateActivitySchema, UpdateActivitySchema } from '../../../shared/schemas/activity.js';

const router = express.Router();

const normalizeCustomPrompt = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeCustomPromptTitle = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 20);
  return trimmed.length > 0 ? trimmed : null;
};

function getCourseCode(course) {
  return (
    (course.externalMetadata &&
      typeof course.externalMetadata === 'object' &&
      typeof course.externalMetadata.code === 'string' &&
      course.externalMetadata.code) ||
    (typeof course.externalId === 'string' ? course.externalId : null)
  );
}

function getActivityAccess(course, authUser) {
  const isInstructorForCourse = course.instructors.some((i) => i.userId === authUser.id);
  const isEnrolledStudent = course.enrollments.some((e) => e.userId === authUser.id);
  return { isInstructorForCourse, isEnrolledStudent };
}

function resolveTopicName(activity, topicId) {
  if (!topicId) {
    return activity.mainTopic?.name;
  }

  const match = activity.secondaryTopics?.find((sec) => sec.topicId === topicId);
  if (match) {
    return match.topic.name;
  }

  if (activity.mainTopic && activity.mainTopic.id === topicId) {
    return activity.mainTopic.name;
  }

  return activity.mainTopic?.name;
}

async function upsertChatSession({ userId, activityId, mode, chatId, tutorModelId }) {
  if (!chatId) return null;

  return prisma.aiChatSession.upsert({
    where: {
      userId_activityId_mode: {
        userId,
        activityId,
        mode,
      },
    },
    update: {
      chatId,
      modelId: tutorModelId ?? null,
    },
    create: {
      userId,
      activityId,
      mode,
      chatId,
      modelId: tutorModelId ?? null,
    },
  });
}

async function persistAiTrace({
  userId,
  activityId,
  mode,
  knowledgeLevel,
  userMessage,
  tutorModelId,
  supervisorModelId,
  finalResponse,
  finalOutcome,
  iterationCount,
  chatId,
  aiChatSessionId,
  trace,
}) {
  try {
    await prisma.aiInteractionTrace.create({
      data: {
        userId,
        activityId,
        mode,
        knowledgeLevel,
        chatId,
        tutorModelId,
        supervisorModelId,
        userMessage,
        finalResponse,
        finalOutcome,
        iterationCount,
        aiChatSessionId,
        trace,
      },
    });
  } catch (error) {
    console.error('Failed to persist AI interaction trace:', error);
  }
}

async function trackAiHelpRequest(userId, activityId) {
  try {
    await recordAiHelpRequest({ userId, activityId });
  } catch (error) {
    console.error('Failed to update AI help metrics:', error);
  }
}

async function trackSubmissionMetrics(userId, activityId, isCorrect) {
  try {
    await recordSubmissionMetrics({ userId, activityId, isCorrect });
  } catch (error) {
    console.error('Failed to update submission metrics:', error);
  }
}

async function loadActivityForChat(activityId) {
  return prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      mainTopic: true,
      secondaryTopics: { include: { topic: true } },
      lesson: {
        include: {
          module: {
            include: {
              courseOffering: {
                select: {
                  id: true,
                  externalId: true,
                  externalSource: true,
                  externalMetadata: true,
                  instructors: { select: { userId: true } },
                  enrollments: { select: { userId: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

async function handleAiInteraction({ req, res, activity, mode, payload, generateResponse }) {
  const authUser = req.user;
  const activityId = activity.id;
  const course = activity.lesson?.module?.courseOffering;

  if (!course) {
    return res.status(500).json({ error: 'Activity course context missing' });
  }

  const { isInstructorForCourse, isEnrolledStudent } = getActivityAccess(course, authUser);
  if (!(isInstructorForCourse || isEnrolledStudent)) {
    return res.status(403).json({ error: 'Not authorized for this activity' });
  }

  try {
    const existingSession =
      payload.chatId && payload.chatId.trim().length > 0
        ? await prisma.aiChatSession.findUnique({
            where: {
              userId_activityId_mode: {
                userId: authUser.id,
                activityId,
                mode,
              },
            },
          })
        : null;

    const { dualLoopEnabled, maxSupervisorIterations, supervisorModelId } =
      await resolveSupervisorSettings();
    const tutorModelId = await resolveTutorModelSelection(payload.modelId);
    const eduAiAccessToken = await getEduAiAccessTokenForUser(authUser.id);
    const chatId = payload.chatId || existingSession?.chatId || null;
    const messageId = payload.messageId || randomUUID();

    const aiResult = await generateResponse({
      tutorModelId,
      supervisorModelId,
      dualLoopEnabled,
      maxSupervisorIterations,
      eduAiAccessToken,
      chatId,
      messageId,
      courseCode: getCourseCode(course),
    });

    const nextChatId = aiResult.chatId || chatId || null;
    const session = await upsertChatSession({
      userId: authUser.id,
      activityId,
      mode,
      chatId: nextChatId,
      tutorModelId,
    });

    await persistAiTrace({
      userId: authUser.id,
      activityId,
      mode,
      knowledgeLevel: payload.knowledgeLevel,
      userMessage: payload.message,
      tutorModelId,
      supervisorModelId,
      finalResponse: aiResult.message,
      finalOutcome: aiResult.trace?.finalOutcome || 'unknown',
      iterationCount: aiResult.trace?.iterationCount || 0,
      chatId: nextChatId,
      aiChatSessionId: session?.id ?? null,
      trace: aiResult.trace || {},
    });

    if (authUser.role === 'STUDENT') {
      await trackAiHelpRequest(authUser.id, activityId);
    }

    return res.json({
      ok: true,
      message: aiResult.message,
      chatId: nextChatId,
      tutorModelId,
      supervisorModelId,
    });
  } catch (error) {
    console.error(`Error generating ${mode} guidance:`, error);
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return res.status(status).json({ error: String(error.message || error) });
  }
}

router.get('/lessons/:lessonId/activities', async (req, res) => {
  const authUser = req.user;
  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const lessonId = Number(req.params.lessonId);
  if (!Number.isFinite(lessonId)) {
    return res.status(400).json({ error: 'Invalid lesson id' });
  }

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            courseOffering: {
              include: {
                instructors: { select: { userId: true } },
                enrollments: { select: { userId: true } },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const isInstructor = lesson.module.courseOffering.instructors.some(
      (assignment) => assignment.userId === authUser.id,
    );
    const isStudent = lesson.module.courseOffering.enrollments.some(
      (enrollment) => enrollment.userId === authUser.id,
    );

    if (authUser.role === 'PROFESSOR' && !isInstructor) {
      return res.status(403).json({ error: 'Not authorized for this lesson' });
    }
    if (authUser.role === 'STUDENT') {
      if (!isStudent) {
        return res.status(403).json({ error: 'Not authorized for this lesson' });
      }
      if (!lesson.isPublished) {
        return res.status(403).json({ error: 'Lesson is not published' });
      }
    }
    if (authUser.role !== 'PROFESSOR' && authUser.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Role is not supported in AI Tutor' });
    }

    const activities = await prisma.activity.findMany({
      where: { lessonId },
      orderBy: { position: 'asc' },
      include: {
        promptTemplate: { select: { id: true, name: true } },
        mainTopic: true,
        secondaryTopics: {
          include: { topic: true },
        },
      },
    });

    // For students, add completion status to each activity
    if (authUser.role === 'STUDENT') {
      const activityIds = activities.map((a) => a.id);
      const statusMap = await getActivityCompletionStatuses(activityIds, authUser.id);

      const activitiesWithStatus = activities.map((activity) => {
        const status = statusMap.get(activity.id) || 'not_attempted';
        return mapActivity({ ...activity, completionStatus: status });
      });

      res.json(activitiesWithStatus);
    } else {
      res.json(activities.map(mapActivity));
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/lessons/:lessonId/activities', requireRole('PROFESSOR'), async (req, res) => {
  const lessonId = Number(req.params.lessonId);
  if (!Number.isFinite(lessonId)) {
    return res.status(400).json({ error: 'Invalid lesson id' });
  }

  // Accept legacy `prompt` field by mapping it to question before validation
  const raw = { ...req.body };
  if (!raw.question && raw.prompt) raw.question = raw.prompt;
  let payload;
  try {
    payload = CreateActivitySchema.parse(raw);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid payload', details: e?.errors || String(e) });
  }

  // Validate at least one AI mode is enabled
  if (!payload.enableTeachMode && !payload.enableGuideMode && !payload.enableCustomMode) {
    return res.status(400).json({ error: 'At least one AI mode must be enabled' });
  }

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: { select: { courseOfferingId: true } },
      },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const courseOfferingId = lesson.module.courseOfferingId;

    const mainTopic = await prisma.topic.findUnique({ where: { id: payload.mainTopicId } });
    if (!mainTopic || mainTopic.courseOfferingId !== courseOfferingId) {
      return res.status(400).json({ error: 'mainTopicId must belong to the lesson course' });
    }

    const normalizedSecondaryIds = Array.isArray(payload.secondaryTopicIds)
      ? Array.from(
          new Set(
            payload.secondaryTopicIds
              .map((value) => Number(value))
              .filter((value) => Number.isFinite(value) && value !== payload.mainTopicId),
          ),
        )
      : [];

    if (normalizedSecondaryIds.length > 0) {
      const topics = await prisma.topic.findMany({
        where: { id: { in: normalizedSecondaryIds } },
      });
      const invalid = topics.some((topic) => topic.courseOfferingId !== courseOfferingId);
      if (invalid || topics.length !== normalizedSecondaryIds.length) {
        return res
          .status(400)
          .json({ error: 'secondaryTopicIds must belong to the lesson course' });
      }
    }

    const activity = await prisma.activity.create({
      data: {
        title: payload.title ?? null,
        instructionsMd: payload.instructionsMd ?? 'Answer the question.',
        lessonId,
        promptTemplateId: payload.promptTemplateId ?? null,
        customPrompt: normalizeCustomPrompt(payload.customPrompt),
        customPromptTitle: normalizeCustomPromptTitle(payload.customPromptTitle),
        mainTopicId: payload.mainTopicId,
        enableTeachMode: payload.enableTeachMode,
        enableGuideMode: payload.enableGuideMode,
        enableCustomMode: payload.enableCustomMode ?? false,
        config: {
          question: payload.question,
          questionType: payload.type ?? 'MCQ',
          options: payload.options,
          answer: payload.answer ?? null,
          hints: Array.isArray(payload.hints) ? payload.hints : [],
        },
        secondaryTopics:
          normalizedSecondaryIds.length > 0
            ? {
                create: normalizedSecondaryIds.map((topicId) => ({
                  topic: { connect: { id: topicId } },
                })),
              }
            : undefined,
      },
      include: {
        promptTemplate: { select: { id: true, name: true } },
        mainTopic: true,
        secondaryTopics: {
          include: { topic: true },
        },
      },
    });

    res.status(201).json(mapActivity(activity));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.patch('/activities/:activityId', requireRole('PROFESSOR'), async (req, res) => {
  const instructor = req.user;
  const activityId = Number(req.params.activityId);
  if (!Number.isFinite(activityId)) {
    return res.status(400).json({ error: 'Invalid activity id' });
  }

  let payload;
  try {
    payload = UpdateActivitySchema.parse(req.body || {});
  } catch (e) {
    return res.status(400).json({ error: 'Invalid payload', details: e?.errors || String(e) });
  }
  const noUpdatableFields =
    typeof payload.promptTemplateId === 'undefined' &&
    typeof payload.customPrompt === 'undefined' &&
    typeof payload.customPromptTitle === 'undefined' &&
    typeof payload.enableCustomMode === 'undefined' &&
    typeof payload.mainTopicId === 'undefined' &&
    typeof payload.secondaryTopicIds === 'undefined' &&
    typeof payload.title === 'undefined' &&
    typeof payload.instructionsMd === 'undefined' &&
    typeof payload.question === 'undefined' &&
    typeof payload.type === 'undefined' &&
    typeof payload.options === 'undefined' &&
    typeof payload.answer === 'undefined' &&
    typeof payload.hints === 'undefined' &&
    typeof payload.enableTeachMode === 'undefined' &&
    typeof payload.enableGuideMode === 'undefined';

  if (noUpdatableFields) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                courseOffering: {
                  include: { instructors: true },
                },
              },
            },
          },
        },
        mainTopic: true,
      },
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const isInstructor = activity.lesson.module.courseOffering.instructors.some(
      (assignment) => assignment.userId === instructor.id,
    );

    if (!isInstructor) {
      return res.status(403).json({ error: 'Not authorized for this activity' });
    }

    const courseOfferingId = activity.lesson.module.courseOfferingId;

    const updateData = {};

    if (typeof payload.title !== 'undefined') {
      if (payload.title === null) {
        updateData.title = null;
      } else {
        const trimmedTitle = payload.title.trim();
        updateData.title = trimmedTitle.length > 0 ? trimmedTitle : null;
      }
    }

    if (typeof payload.instructionsMd !== 'undefined') {
      updateData.instructionsMd = payload.instructionsMd;
    }

    const currentConfig =
      activity.config && typeof activity.config === 'object' ? { ...activity.config } : {};
    let configChanged = false;

    if (typeof payload.question !== 'undefined') {
      const questionText = payload.question.trim();
      if (questionText.length === 0) {
        return res.status(400).json({ error: 'question must not be empty' });
      }
      currentConfig.question = questionText;
      configChanged = true;
    }

    if (typeof payload.type !== 'undefined') {
      currentConfig.questionType = payload.type;
      if (payload.type === 'SHORT_TEXT') {
        currentConfig.options = null;
      }
      configChanged = true;
    }

    if (typeof payload.options !== 'undefined') {
      if (payload.options === null) {
        currentConfig.options = null;
      } else {
        currentConfig.options = payload.options.map((choice) => choice);
      }
      configChanged = true;
    }

    if (typeof payload.answer !== 'undefined') {
      currentConfig.answer = payload.answer;
      configChanged = true;
    }

    if (typeof payload.hints !== 'undefined') {
      const normalizedHints = Array.isArray(payload.hints)
        ? payload.hints.map((hint) => hint.trim()).filter((hint) => hint.length > 0)
        : [];
      currentConfig.hints = normalizedHints;
      configChanged = true;
    }

    if (configChanged) {
      updateData.config = currentConfig;
    }

    if (typeof payload.promptTemplateId !== 'undefined') {
      if (payload.promptTemplateId === null) {
        updateData.promptTemplateId = null;
      } else if (typeof payload.promptTemplateId === 'number') {
        const prompt = await prisma.promptTemplate.findUnique({
          where: { id: payload.promptTemplateId },
        });
        if (!prompt) {
          return res.status(400).json({ error: 'Invalid promptTemplateId' });
        }
        updateData.promptTemplateId = payload.promptTemplateId;
      } else {
        return res.status(400).json({ error: 'promptTemplateId must be a number or null' });
      }
    }

    if (typeof payload.customPrompt !== 'undefined') {
      if (payload.customPrompt === null) {
        updateData.customPrompt = null;
      } else if (typeof payload.customPrompt === 'string') {
        updateData.customPrompt = normalizeCustomPrompt(payload.customPrompt);
      } else {
        return res.status(400).json({ error: 'customPrompt must be a string or null' });
      }
    }

    if (typeof payload.customPromptTitle !== 'undefined') {
      if (payload.customPromptTitle === null) {
        updateData.customPromptTitle = null;
      } else if (typeof payload.customPromptTitle === 'string') {
        updateData.customPromptTitle = normalizeCustomPromptTitle(payload.customPromptTitle);
      } else {
        return res.status(400).json({ error: 'customPromptTitle must be a string or null' });
      }
    }

    let resolvedMainTopicId = activity.mainTopicId;
    if (typeof payload.mainTopicId !== 'undefined') {
      if (typeof payload.mainTopicId !== 'number' || !Number.isFinite(payload.mainTopicId)) {
        return res.status(400).json({ error: 'mainTopicId must be a number' });
      }
      const mainTopic = await prisma.topic.findUnique({ where: { id: payload.mainTopicId } });
      if (!mainTopic || mainTopic.courseOfferingId !== courseOfferingId) {
        return res.status(400).json({ error: 'mainTopicId must belong to the activity course' });
      }
      updateData.mainTopicId = payload.mainTopicId;
      resolvedMainTopicId = payload.mainTopicId;
    }

    if (typeof payload.secondaryTopicIds !== 'undefined') {
      if (!Array.isArray(payload.secondaryTopicIds)) {
        return res.status(400).json({ error: 'secondaryTopicIds must be an array of ids' });
      }
      const normalizedSecondaryIds = Array.from(
        new Set(
          payload.secondaryTopicIds
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value !== resolvedMainTopicId),
        ),
      );

      if (normalizedSecondaryIds.length > 0) {
        const topics = await prisma.topic.findMany({
          where: { id: { in: normalizedSecondaryIds } },
        });
        const invalid = topics.some((topic) => topic.courseOfferingId !== courseOfferingId);
        if (invalid || topics.length !== normalizedSecondaryIds.length) {
          return res
            .status(400)
            .json({ error: 'secondaryTopicIds must belong to the activity course' });
        }
      }

      updateData.secondaryTopics = {
        deleteMany: {},
        create: normalizedSecondaryIds.map((topicId) => ({
          topic: { connect: { id: topicId } },
        })),
      };
    }

    const requestedModeUpdate =
      typeof payload.enableTeachMode !== 'undefined' ||
      typeof payload.enableGuideMode !== 'undefined' ||
      typeof payload.enableCustomMode !== 'undefined';

    // Handle AI mode updates with validation
    if (requestedModeUpdate) {
      const newTeachMode =
        typeof payload.enableTeachMode !== 'undefined'
          ? payload.enableTeachMode
          : activity.enableTeachMode;
      const newGuideMode =
        typeof payload.enableGuideMode !== 'undefined'
          ? payload.enableGuideMode
          : activity.enableGuideMode;
      const newCustomMode =
        typeof payload.enableCustomMode !== 'undefined'
          ? payload.enableCustomMode
          : activity.enableCustomMode;

      // Validate at least one mode is enabled
      if (!newTeachMode && !newGuideMode && !newCustomMode) {
        return res.status(400).json({ error: 'At least one AI mode must be enabled' });
      }

      if (typeof payload.enableTeachMode !== 'undefined') {
        updateData.enableTeachMode = payload.enableTeachMode;
      }
      if (typeof payload.enableGuideMode !== 'undefined') {
        updateData.enableGuideMode = payload.enableGuideMode;
      }
      if (typeof payload.enableCustomMode !== 'undefined') {
        updateData.enableCustomMode = payload.enableCustomMode;
      }
    }

    const updated = await prisma.activity.update({
      where: { id: activityId },
      data: updateData,
      include: {
        promptTemplate: { select: { id: true, name: true } },
        mainTopic: true,
        secondaryTopics: {
          include: { topic: true },
        },
      },
    });

    res.json(mapActivity(updated));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete('/activities/:activityId', requireRole('PROFESSOR'), async (req, res) => {
  const instructor = req.user;
  const activityId = Number(req.params.activityId);
  if (!Number.isFinite(activityId)) {
    return res.status(400).json({ error: 'Invalid activity id' });
  }

  try {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                courseOffering: {
                  include: { instructors: true },
                },
              },
            },
          },
        },
      },
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const isInstructor = activity.lesson.module.courseOffering.instructors.some(
      (assignment) => assignment.userId === instructor.id,
    );

    if (!isInstructor) {
      return res.status(403).json({ error: 'Not authorized for this activity' });
    }

    await prisma.activity.delete({ where: { id: activityId } });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/questions/:id/answer', async (req, res) => {
  const activityId = Number(req.params.id);
  if (!Number.isFinite(activityId)) {
    return res.status(400).json({ error: 'Invalid activity id' });
  }

  // Always use the authenticated user; never trust body.userId
  const authUser = req.user;
  if (!authUser) return res.status(401).json({ error: 'Authentication required' });

  const { answerText, answerOption } = req.body || {};

  try {
    // Load activity with course offering context for authorization
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                courseOffering: {
                  select: {
                    id: true,
                    externalId: true,
                    externalSource: true,
                    externalMetadata: true,
                    instructors: { select: { userId: true } },
                    enrollments: { select: { userId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    // Authorization: user must be enrolled (student) or an instructor of the course
    const course = activity.lesson?.module?.courseOffering;
    if (!course) return res.status(500).json({ error: 'Activity course context missing' });

    const isInstructorForCourse = course.instructors.some((i) => i.userId === authUser.id);
    const isEnrolledStudent = course.enrollments.some((e) => e.userId === authUser.id);

    if (!(isInstructorForCourse || isEnrolledStudent)) {
      return res.status(403).json({ error: 'Not authorized for this activity' });
    }

    const { isCorrect } = evaluateQuestion(activity, {
      answerText,
      answerOption,
    });

    // Get the latest attempt number for this activity and user
    const latestSubmission = await prisma.submission.findFirst({
      where: { userId: authUser.id, activityId },
      orderBy: { attemptNumber: 'desc' },
      select: { attemptNumber: true },
    });

    const nextAttemptNumber = latestSubmission ? latestSubmission.attemptNumber + 1 : 1;

    const submission = await prisma.submission.create({
      data: {
        userId: authUser.id,
        activityId,
        attemptNumber: nextAttemptNumber,
        response: {
          answerText: typeof answerText === 'string' ? answerText : null,
          answerOption: typeof answerOption === 'number' ? answerOption : null,
        },
        aiFeedback: isCorrect
          ? { message: 'Nice! That looks right.' }
          : { message: 'Not quite. Try another angle.' },
        isCorrect,
      },
    });

    if (authUser.role === 'STUDENT') {
      await trackSubmissionMetrics(authUser.id, activityId, Boolean(isCorrect));
    }
    const feedbackAlreadySubmitted =
      authUser.role === 'STUDENT'
        ? await hasActivityFeedback({ userId: authUser.id, activityId })
        : true;

    res.json({
      ok: true,
      isCorrect,
      message: isCorrect ? 'Nice! That looks right.' : 'Not quite. Try another angle.',
      submissionId: submission.id,
      feedbackRequired: !feedbackAlreadySubmitted,
      feedbackAlreadySubmitted,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/activities/:activityId/teach', async (req, res) => {
  const authUser = req.user;
  const activityId = Number(req.params.activityId);

  if (!Number.isFinite(activityId)) {
    return res.status(400).json({ error: 'Invalid activity id' });
  }

  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let payload;
  try {
    payload = TeachRequestSchema.parse(req.body || {});
  } catch (error) {
    return res
      .status(400)
      .json({ error: 'Invalid payload', details: error?.errors || String(error) });
  }

  try {
    const activity = await loadActivityForChat(activityId);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    const topicName = resolveTopicName(activity, payload.topicId);
    return handleAiInteraction({
      req,
      res,
      activity,
      mode: 'teach',
      payload,
      generateResponse: (context) =>
        generateTeachResponse({
          activity,
          topicName,
          knowledgeLevel: payload.knowledgeLevel,
          message: payload.message,
          apiKey: payload.apiKey,
          ...context,
        }),
    });
  } catch (e) {
    console.error('Error generating guidance:', e);
    res.status(500).json({ error: String(e) });
  }
});

router.post('/activities/:activityId/guide', async (req, res) => {
  const authUser = req.user;
  const activityId = Number(req.params.activityId);

  if (!Number.isFinite(activityId)) {
    return res.status(400).json({ error: 'Invalid activity id' });
  }

  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let payload;
  try {
    payload = GuideRequestSchema.parse(req.body || {});
  } catch (error) {
    return res
      .status(400)
      .json({ error: 'Invalid payload', details: error?.errors || String(error) });
  }

  try {
    const activity = await loadActivityForChat(activityId);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    return handleAiInteraction({
      req,
      res,
      activity,
      mode: 'guide',
      payload,
      generateResponse: (context) =>
        generateGuideResponse({
          activity,
          knowledgeLevel: payload.knowledgeLevel,
          message: payload.message,
          studentAnswer: payload.studentAnswer,
          apiKey: payload.apiKey,
          ...context,
        }),
    });
  } catch (e) {
    console.error('Error generating guidance:', e);
    res.status(500).json({ error: String(e) });
  }
});

router.post('/activities/:activityId/custom', async (req, res) => {
  const authUser = req.user;
  const activityId = Number(req.params.activityId);

  if (!Number.isFinite(activityId)) {
    return res.status(400).json({ error: 'Invalid activity id' });
  }

  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let payload;
  try {
    payload = CustomRequestSchema.parse(req.body || {});
  } catch (error) {
    return res
      .status(400)
      .json({ error: 'Invalid payload', details: error?.errors || String(error) });
  }

  try {
    const activity = await loadActivityForChat(activityId);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Check if custom mode is enabled and has a prompt
    if (!activity.enableCustomMode) {
      return res.status(400).json({ error: 'Custom mode is not enabled for this activity' });
    }

    if (!activity.customPrompt) {
      return res.status(400).json({ error: 'No custom prompt configured for this activity' });
    }

    const topicName = resolveTopicName(activity, payload.topicId);
    return handleAiInteraction({
      req,
      res,
      activity,
      mode: 'custom',
      payload,
      generateResponse: (context) =>
        generateCustomResponse({
          activity,
          topicName,
          knowledgeLevel: payload.knowledgeLevel,
          message: payload.message,
          studentAnswer: payload.studentAnswer,
          apiKey: payload.apiKey,
          ...context,
        }),
    });
  } catch (e) {
    console.error('Error generating custom response:', e);
    res.status(500).json({ error: String(e) });
  }
});

router.post('/activities/:activityId/feedback', async (req, res) => {
  const authUser = req.user;
  const activityId = Number(req.params.activityId);

  if (!Number.isFinite(activityId)) {
    return res.status(400).json({ error: 'Invalid activity id' });
  }

  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let payload;
  try {
    payload = ActivityFeedbackRequestSchema.parse(req.body || {});
  } catch (error) {
    return res
      .status(400)
      .json({ error: 'Invalid payload', details: error?.errors || String(error) });
  }

  try {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                courseOffering: {
                  select: {
                    enrollments: { select: { userId: true } },
                    instructors: { select: { userId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const course = activity.lesson?.module?.courseOffering;
    if (!course) {
      return res.status(500).json({ error: 'Activity course context missing' });
    }

    const { isEnrolledStudent } = getActivityAccess(course, authUser);
    if (!isEnrolledStudent || authUser.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Only enrolled students can submit activity feedback' });
    }

    const alreadySubmitted = await hasActivityFeedback({ userId: authUser.id, activityId });
    if (alreadySubmitted) {
      return res.status(409).json({ error: 'Feedback already submitted for this activity' });
    }

    const latestSubmission = await prisma.submission.findFirst({
      where: { userId: authUser.id, activityId },
      orderBy: { attemptNumber: 'desc' },
      select: { id: true },
    });

    if (!latestSubmission) {
      return res.status(400).json({ error: 'Submit an answer before leaving feedback' });
    }

    const feedback = await recordActivityFeedback({
      userId: authUser.id,
      activityId,
      submissionId: latestSubmission.id,
      rating: payload.rating,
      note: payload.note,
    });

    res.status(201).json({
      ok: true,
      feedback: {
        id: feedback.id,
        rating: feedback.rating,
        note: feedback.note,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Feedback already submitted for this activity' });
    }
    console.error('Error recording activity feedback:', error);
    res.status(500).json({ error: String(error) });
  }
});

export default router;
