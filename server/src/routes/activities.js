import express from 'express';
import { prisma } from '../config/database.js';
import { requireRole } from '../middleware/auth.js';
import { mapActivity } from '../utils/mappers.js';
import { evaluateQuestion } from '../services/activityEvaluation.js';

const router = express.Router();

router.get('/lessons/:lessonId/activities', async (req, res) => {
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
      },
    });
    res.json(activities.map(mapActivity));
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
  } =
    req.body || {};

  const questionText = question ?? prompt;

  if (!questionText) {
    return res.status(400).json({ error: 'question required' });
  }

  try {
    const activity = await prisma.activity.create({
      data: {
        title: title ?? null,
        instructionsMd: instructionsMd ?? 'Answer the question.',
        lessonId,
        promptTemplateId: promptTemplateId ?? null,
        config: {
          question: questionText,
          questionType: type ?? 'MCQ',
          options: options ?? null,
          answer: answer ?? null,
          hints: Array.isArray(hints) ? hints : [],
        },
      },
      include: {
        promptTemplate: { select: { id: true, name: true } },
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

  const { promptTemplateId } = req.body || {};
  if (typeof promptTemplateId === 'undefined') {
    return res.status(400).json({ error: 'promptTemplateId is required' });
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

    let resolvedPromptId = null;
    if (promptTemplateId === null) {
      resolvedPromptId = null;
    } else if (typeof promptTemplateId === 'number') {
      const prompt = await prisma.promptTemplate.findUnique({
        where: { id: promptTemplateId },
      });
      if (!prompt) {
        return res.status(400).json({ error: 'Invalid promptTemplateId' });
      }
      resolvedPromptId = promptTemplateId;
    } else {
      return res.status(400).json({ error: 'promptTemplateId must be a number or null' });
    }

    const updated = await prisma.activity.update({
      where: { id: activityId },
      data: { promptTemplateId: resolvedPromptId },
      include: {
        promptTemplate: { select: { id: true, name: true } },
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

  const { userId, answerText, answerOption } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    const { isCorrect, assistantCue } = evaluateQuestion(activity, {
      answerText,
      answerOption,
    });

    await prisma.submission.create({
      data: {
        userId,
        activityId,
        attemptNumber: 1,
        response: {
          answerText: answerText ?? null,
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
      assistantCue,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;