import express from 'express';
import { prisma } from '../config/database.js';
import { requireRole } from '../middleware/auth.js';
import { mapActivity } from '../utils/mappers.js';
import { evaluateQuestion } from '../services/activityEvaluation.js';
import { getActivityCompletionStatuses } from '../services/progressCalculation.js';
import {
  generateGuideResponse,
  generateTeachResponse,
} from '../services/aiGuidance.js';
import { GuideRequestSchema, TeachRequestSchema } from '../../../shared/schemas/aiGuidance.js';
import { CreateActivitySchema, UpdateActivitySchema } from '../../../shared/schemas/activity.js';

const router = express.Router();

router.get('/lessons/:lessonId/activities', async (req, res) => {
  const authUser = req.user;
  const lessonId = Number(req.params.lessonId);
  if (!Number.isFinite(lessonId)) {
    return res.status(400).json({ error: 'Invalid lesson id' });
  }

  try {
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
    if (authUser && authUser.role === 'STUDENT') {
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

router.post('/lessons/:lessonId/activities', requireRole('INSTRUCTOR'), async (req, res) => {
  const lessonId = Number(req.params.lessonId);
  if (!Number.isFinite(lessonId)) {
    return res.status(400).json({ error: 'Invalid lesson id' });
  }

  // Accept legacy `prompt` field by mapping it to question before validation
  const raw = { ...(req.body || {}) };
  if (!raw.question && raw.prompt) raw.question = raw.prompt;
  let payload;
  try {
    payload = CreateActivitySchema.parse(raw);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid payload', details: e?.errors || String(e) });
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
        return res.status(400).json({ error: 'secondaryTopicIds must belong to the lesson course' });
      }
    }

    const activity = await prisma.activity.create({
      data: {
        title: payload.title ?? null,
        instructionsMd: payload.instructionsMd ?? 'Answer the question.',
        lessonId,
        promptTemplateId: payload.promptTemplateId ?? null,
        mainTopicId: payload.mainTopicId,
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

router.patch('/activities/:activityId', requireRole('INSTRUCTOR'), async (req, res) => {
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
    typeof payload.mainTopicId === 'undefined' &&
    typeof payload.secondaryTopicIds === 'undefined' &&
    typeof payload.title === 'undefined' &&
    typeof payload.instructionsMd === 'undefined' &&
    typeof payload.question === 'undefined' &&
    typeof payload.type === 'undefined' &&
    typeof payload.options === 'undefined' &&
    typeof payload.answer === 'undefined' &&
    typeof payload.hints === 'undefined';

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

    const currentConfig = activity.config && typeof activity.config === 'object'
      ? { ...activity.config }
      : {};
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
        ? payload.hints
            .map((hint) => hint.trim())
            .filter((hint) => hint.length > 0)
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
        const prompt = await prisma.promptTemplate.findUnique({ where: { id: payload.promptTemplateId } });
        if (!prompt) {
          return res.status(400).json({ error: 'Invalid promptTemplateId' });
        }
        updateData.promptTemplateId = payload.promptTemplateId;
      } else {
        return res.status(400).json({ error: 'promptTemplateId must be a number or null' });
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
        const topics = await prisma.topic.findMany({ where: { id: { in: normalizedSecondaryIds } } });
        const invalid = topics.some((topic) => topic.courseOfferingId !== courseOfferingId);
        if (invalid || topics.length !== normalizedSecondaryIds.length) {
          return res.status(400).json({ error: 'secondaryTopicIds must belong to the activity course' });
        }
      }

      updateData.secondaryTopics = {
        deleteMany: {},
        create: normalizedSecondaryIds.map((topicId) => ({
          topic: { connect: { id: topicId } },
        })),
      };
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

router.delete('/activities/:activityId', requireRole('INSTRUCTOR'), async (req, res) => {
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

    await prisma.submission.create({
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

    res.json({
      ok: true,
      isCorrect,
      message: isCorrect ? 'Nice! That looks right.' : 'Not quite. Try another angle.',
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
    return res.status(400).json({ error: 'Invalid payload', details: error?.errors || String(error) });
  }

  try {
    // Load activity with course offering context for authorization
    const activity = await prisma.activity.findUnique({
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

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Authorization: user must be enrolled (student) or an instructor of the course
    const course = activity.lesson?.module?.courseOffering;
    if (!course) {
      return res.status(500).json({ error: 'Activity course context missing' });
    }

    const isInstructorForCourse = course.instructors.some((i) => i.userId === authUser.id);
    const isEnrolledStudent = course.enrollments.some((e) => e.userId === authUser.id);

    if (!(isInstructorForCourse || isEnrolledStudent)) {
      return res.status(403).json({ error: 'Not authorized for this activity' });
    }

    const topicName = (() => {
      if (!payload.topicId) {
        return activity.mainTopic?.name;
      }
      const match = activity.secondaryTopics.find((sec) => sec.topicId === payload.topicId);
      if (match) {
        return match.topic.name;
      }
      if (activity.mainTopic && activity.mainTopic.id === payload.topicId) {
        return activity.mainTopic.name;
      }
      return activity.mainTopic?.name;
    })();

    const aiMessage = await generateTeachResponse({
      activity,
      topicName,
      knowledgeLevel: payload.knowledgeLevel,
      message: payload.message,
    });

    res.json({
      ok: true,
      message: aiMessage,
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
    return res.status(400).json({ error: 'Invalid payload', details: error?.errors || String(error) });
  }

  try {
    // Load activity with course offering context for authorization
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        mainTopic: true,
        lesson: {
          include: {
            module: {
              include: {
                courseOffering: {
                  select: {
                    id: true,
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

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Authorization: user must be enrolled (student) or an instructor of the course
    const course = activity.lesson?.module?.courseOffering;
    if (!course) {
      return res.status(500).json({ error: 'Activity course context missing' });
    }

    const isInstructorForCourse = course.instructors.some((i) => i.userId === authUser.id);
    const isEnrolledStudent = course.enrollments.some((e) => e.userId === authUser.id);

    if (!(isInstructorForCourse || isEnrolledStudent)) {
      return res.status(403).json({ error: 'Not authorized for this activity' });
    }

    const aiMessage = await generateGuideResponse({
      activity,
      knowledgeLevel: payload.knowledgeLevel,
      message: payload.message,
      studentAnswer: payload.studentAnswer,
    });

    res.json({
      ok: true,
      message: aiMessage,
    });
  } catch (e) {
    console.error('Error generating guidance:', e);
    res.status(500).json({ error: String(e) });
  }
});

export default router;
