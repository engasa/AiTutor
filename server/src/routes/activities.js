import express from 'express';
import { prisma } from '../config/database.js';
import { requireRole } from '../middleware/auth.js';
import { mapActivity } from '../utils/mappers.js';
import { evaluateQuestion } from '../services/activityEvaluation.js';
import { getActivityCompletionStatuses } from '../services/progressCalculation.js';
import { generateGuidance } from '../services/aiGuidance.js';

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

  const {
    title,
    question,
    prompt,
    type,
    options,
    answer,
    hints,
    instructionsMd,
    promptTemplateId,
    mainTopicId,
    secondaryTopicIds,
  } = req.body || {};

  const questionText = question ?? prompt;

  if (!questionText) {
    return res.status(400).json({ error: 'question required' });
  }

  if (typeof mainTopicId !== 'number' || !Number.isFinite(mainTopicId)) {
    return res.status(400).json({ error: 'mainTopicId is required' });
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

    const mainTopic = await prisma.topic.findUnique({ where: { id: mainTopicId } });
    if (!mainTopic || mainTopic.courseOfferingId !== courseOfferingId) {
      return res.status(400).json({ error: 'mainTopicId must belong to the lesson course' });
    }

    const normalizedSecondaryIds = Array.isArray(secondaryTopicIds)
      ? Array.from(
          new Set(
            secondaryTopicIds
              .map((value) => Number(value))
              .filter((value) => Number.isFinite(value) && value !== mainTopicId),
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

    // Normalize options to an array of strings in stored config
    const normalizedOptions = (() => {
      if (Array.isArray(options)) return options;
      if (options && Array.isArray(options.choices)) return options.choices;
      return null;
    })();

    const activity = await prisma.activity.create({
      data: {
        title: title ?? null,
        instructionsMd: instructionsMd ?? 'Answer the question.',
        lessonId,
        promptTemplateId: promptTemplateId ?? null,
        mainTopicId,
        config: {
          question: questionText,
          questionType: type ?? 'MCQ',
          options: normalizedOptions,
          answer: answer ?? null,
          hints: Array.isArray(hints) ? hints : [],
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

  const { promptTemplateId, mainTopicId, secondaryTopicIds } = req.body || {};

  if (
    typeof promptTemplateId === 'undefined' &&
    typeof mainTopicId === 'undefined' &&
    typeof secondaryTopicIds === 'undefined'
  ) {
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

    if (typeof promptTemplateId !== 'undefined') {
      if (promptTemplateId === null) {
        updateData.promptTemplateId = null;
      } else if (typeof promptTemplateId === 'number') {
        const prompt = await prisma.promptTemplate.findUnique({ where: { id: promptTemplateId } });
        if (!prompt) {
          return res.status(400).json({ error: 'Invalid promptTemplateId' });
        }
        updateData.promptTemplateId = promptTemplateId;
      } else {
        return res.status(400).json({ error: 'promptTemplateId must be a number or null' });
      }
    }

    let resolvedMainTopicId = activity.mainTopicId;
    if (typeof mainTopicId !== 'undefined') {
      if (typeof mainTopicId !== 'number' || !Number.isFinite(mainTopicId)) {
        return res.status(400).json({ error: 'mainTopicId must be a number' });
      }
      const mainTopic = await prisma.topic.findUnique({ where: { id: mainTopicId } });
      if (!mainTopic || mainTopic.courseOfferingId !== courseOfferingId) {
        return res.status(400).json({ error: 'mainTopicId must belong to the activity course' });
      }
      updateData.mainTopicId = mainTopicId;
      resolvedMainTopicId = mainTopicId;
    }

    if (typeof secondaryTopicIds !== 'undefined') {
      if (!Array.isArray(secondaryTopicIds)) {
        return res.status(400).json({ error: 'secondaryTopicIds must be an array of ids' });
      }
      const normalizedSecondaryIds = Array.from(
        new Set(
          secondaryTopicIds
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

router.post('/activities/:activityId/guidance', async (req, res) => {
  const authUser = req.user;
  const activityId = Number(req.params.activityId);

  if (!Number.isFinite(activityId)) {
    return res.status(400).json({ error: 'Invalid activity id' });
  }

  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { studentAnswer, knowledgeLevel, codeSnippet } = req.body || {};

  try {
    // Load activity with course offering context for authorization
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        promptTemplate: { select: { id: true, systemPrompt: true } },
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

    // Generate AI guidance with knowledge level and code snippet context
    const aiMessage = await generateGuidance(activity, studentAnswer, knowledgeLevel, codeSnippet);

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
