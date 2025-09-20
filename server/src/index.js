import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from './middleware/auth.js';

dotenv.config();
const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

function toPublicUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

async function cloneTemplateIntoOffering(templateId, offeringId, options = {}) {
  const template = await prisma.courseTemplate.findUnique({
    where: { id: templateId },
    include: {
      modules: {
        orderBy: { position: 'asc' },
        include: {
          lessons: {
            orderBy: { position: 'asc' },
            include: {
              activities: { orderBy: { position: 'asc' } },
            },
          },
        },
      },
    },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  const { moduleIds = null, lessonIds = null } = options;

  for (const moduleTemplate of template.modules) {
    if (Array.isArray(moduleIds) && moduleIds.length > 0 && !moduleIds.includes(moduleTemplate.id)) {
      continue;
    }

    const module = await prisma.module.create({
      data: {
        title: moduleTemplate.title,
        description: moduleTemplate.description,
        position: moduleTemplate.position,
        courseOfferingId: offeringId,
        templateId: moduleTemplate.id,
      },
    });

    for (const lessonTemplate of moduleTemplate.lessons) {
      if (
        Array.isArray(lessonIds) &&
        lessonIds.length > 0 &&
        !lessonIds.includes(lessonTemplate.id)
      ) {
        continue;
      }

      const lesson = await prisma.lesson.create({
        data: {
          title: lessonTemplate.title,
          contentMd: lessonTemplate.contentMd,
          position: lessonTemplate.position,
          moduleId: module.id,
          templateId: lessonTemplate.id,
        },
      });

      for (const activityTemplate of lessonTemplate.activities) {
        await prisma.activity.create({
          data: {
            title: activityTemplate.title,
            instructionsMd: activityTemplate.instructionsMd,
            position: activityTemplate.position,
            lessonId: lesson.id,
            templateId: activityTemplate.id,
            activityTypeId: activityTemplate.activityTypeId,
            promptTemplateId: activityTemplate.promptTemplateId,
            config: activityTemplate.config,
          },
        });
      }
    }
  }
}

async function cloneLessonsFromOffering(sourceLessonIds, targetModuleId) {
  const lessons = await prisma.lesson.findMany({
    where: { id: { in: sourceLessonIds } },
    include: { activities: true },
  });

  for (const lesson of lessons) {
    const createdLesson = await prisma.lesson.create({
      data: {
        title: lesson.title,
        contentMd: lesson.contentMd,
        position: lesson.position,
        moduleId: targetModuleId,
        templateId: lesson.templateId,
      },
    });

    for (const activity of lesson.activities) {
      await prisma.activity.create({
        data: {
          title: activity.title,
          instructionsMd: activity.instructionsMd,
          position: activity.position,
          lessonId: createdLesson.id,
          templateId: activity.templateId,
          activityTypeId: activity.activityTypeId,
          promptTemplateId: activity.promptTemplateId,
          config: activity.config,
        },
      });
    }
  }
}

async function cloneTemplateLessonsIntoModule(lessonTemplateIds, targetModuleId) {
  const lessonTemplates = await prisma.lessonTemplate.findMany({
    where: { id: { in: lessonTemplateIds } },
    orderBy: { position: 'asc' },
    include: {
      activities: { orderBy: { position: 'asc' } },
    },
  });

  for (const template of lessonTemplates) {
    const lesson = await prisma.lesson.create({
      data: {
        title: template.title,
        contentMd: template.contentMd,
        position: template.position,
        moduleId: targetModuleId,
        templateId: template.id,
      },
    });

    for (const activityTemplate of template.activities) {
      await prisma.activity.create({
        data: {
          title: activityTemplate.title,
          instructionsMd: activityTemplate.instructionsMd,
          position: activityTemplate.position,
          lessonId: lesson.id,
          templateId: activityTemplate.id,
          activityTypeId: activityTemplate.activityTypeId,
          promptTemplateId: activityTemplate.promptTemplateId,
          config: activityTemplate.config,
        },
      });
    }
  }
}

function mapCourseOffering(offering) {
  return {
    id: offering.id,
    title: offering.title,
    description: offering.description,
    status: offering.status,
    startDate: offering.startDate,
    endDate: offering.endDate,
    templateId: offering.templateId,
  };
}

function mapModule(module) {
  return {
    id: module.id,
    title: module.title,
    description: module.description,
    position: module.position,
    templateId: module.templateId,
  };
}

function mapLesson(lesson) {
  return {
    id: lesson.id,
    title: lesson.title,
    contentMd: lesson.contentMd,
    position: lesson.position,
    templateId: lesson.templateId,
  };
}

function mapActivity(activity) {
  const config = activity.config ?? {};
  return {
    id: activity.id,
    title: activity.title,
    instructionsMd: activity.instructionsMd,
    position: activity.position,
    activityTypeId: activity.activityTypeId,
    promptTemplateId: activity.promptTemplateId,
    promptTemplate: activity.promptTemplate
      ? { id: activity.promptTemplate.id, name: activity.promptTemplate.name }
      : null,
    templateId: activity.templateId,
    question: config.question ?? config.prompt ?? activity.instructionsMd,
    type: config.questionType ?? 'MCQ',
    options: config.options ?? null,
    answer: config.answer ?? null,
    hints: Array.isArray(config.hints) ? config.hints : [],
  };
}

function evaluateQuestion(activity, payload) {
  const config = activity.config ?? {};
  const questionType = config.questionType ?? 'MCQ';
  let isCorrect = null;

  if (questionType === 'MCQ') {
    const expected = config.answer?.correctIndex;
    if (typeof expected === 'number' && typeof payload.answerOption === 'number') {
      isCorrect = expected === payload.answerOption;
    }
  } else if (questionType === 'SHORT_TEXT') {
    const expected = config.answer?.text ? String(config.answer.text) : '';
    if (typeof payload.answerText === 'string') {
      isCorrect =
        expected &&
        payload.answerText.trim().toLowerCase() === expected.trim().toLowerCase();
    }
  }

  const hints = Array.isArray(config.hints) ? config.hints : [];
  const assistantCue = hints.length > 0 ? hints[0] : 'Reflect on the key ideas in the question.';

  return {
    isCorrect,
    assistantCue,
  };
}

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: '24h',
    });

    res.json({ token, user: toPublicUser(user) });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/login') {
    return next();
  }
  authenticateToken(req, res, next);
});

app.get('/api/me', async (req, res) => {
  const authUser = req.user;
  res.json({ user: toPublicUser(authUser) });
});

app.get('/api/templates', requireRole('INSTRUCTOR'), async (req, res) => {
  try {
    const templates = await prisma.courseTemplate.findMany({
      orderBy: { title: 'asc' },
      include: {
        modules: {
          select: {
            id: true,
            title: true,
            lessons: { select: { id: true, title: true } },
          },
        },
      },
    });
    res.json(templates);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/templates/:templateId', requireRole('INSTRUCTOR'), async (req, res) => {
  const templateId = Number(req.params.templateId);
  if (!Number.isFinite(templateId)) {
    return res.status(400).json({ error: 'Invalid template id' });
  }

  try {
    const template = await prisma.courseTemplate.findUnique({
      where: { id: templateId },
      include: {
        modules: {
          orderBy: { position: 'asc' },
          include: {
            lessons: {
              orderBy: { position: 'asc' },
              include: { activities: { orderBy: { position: 'asc' } } },
            },
          },
        },
      },
    });

    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/courses', async (req, res) => {
  const authUser = req.user;
  if (!authUser) return res.status(401).json({ error: 'Authentication required' });

  try {
    if (authUser.role === 'INSTRUCTOR') {
      const courses = await prisma.courseOffering.findMany({
        where: { instructors: { some: { userId: authUser.id } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(courses.map(mapCourseOffering));
    } else {
      const courses = await prisma.courseOffering.findMany({
        where: { enrollments: { some: { userId: authUser.id } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(courses.map(mapCourseOffering));
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/courses', requireRole('INSTRUCTOR'), async (req, res) => {
  const instructor = req.user;
  const { title, description, templateId, cloneContent = true, status = 'DRAFT', startDate, endDate } =
    req.body || {};

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const offering = await prisma.courseOffering.create({
      data: {
        title,
        description,
        templateId: templateId ?? null,
        status,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    await prisma.courseInstructor.create({
      data: {
        courseOfferingId: offering.id,
        userId: instructor.id,
        role: 'LEAD',
      },
    });

    if (templateId && cloneContent) {
      await cloneTemplateIntoOffering(templateId, offering.id);
    }

    const created = await prisma.courseOffering.findUnique({
      where: { id: offering.id },
      include: {
        modules: {
          orderBy: { position: 'asc' },
          include: {
            lessons: { orderBy: { position: 'asc' } },
          },
        },
      },
    });

    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch('/api/courses/:courseId', requireRole('INSTRUCTOR'), async (req, res) => {
  const instructor = req.user;
  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  const { status, title, description, startDate, endDate } = req.body || {};

  if (!status && !title && !description && !startDate && !endDate) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  if (status && !['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const instructorAssignment = await prisma.courseInstructor.findFirst({
      where: { courseOfferingId: courseId, userId: instructor.id },
    });
    if (!instructorAssignment) {
      return res.status(403).json({ error: 'Not authorized for this course' });
    }

    const updated = await prisma.courseOffering.update({
      where: { id: courseId },
      data: {
        status: status ?? undefined,
        title: title ?? undefined,
        description: description ?? undefined,
        startDate: startDate ? new Date(startDate) : startDate === null ? null : undefined,
        endDate: endDate ? new Date(endDate) : endDate === null ? null : undefined,
      },
    });

    res.json(mapCourseOffering(updated));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/courses/:courseId/import', requireRole('INSTRUCTOR'), async (req, res) => {
  const instructor = req.user;
  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  const { templateId, moduleTemplateIds, lessonTemplateIds, sourceLessonIds, targetModuleId } =
    req.body || {};

  try {
    const instructorAssignment = await prisma.courseInstructor.findFirst({
      where: { courseOfferingId: courseId, userId: instructor.id },
    });
    if (!instructorAssignment) {
      return res.status(403).json({ error: 'Not authorized for this course' });
    }

    const templateLessonIds = Array.isArray(lessonTemplateIds)
      ? lessonTemplateIds.filter((id) => typeof id === 'number')
      : [];

    if (templateId && templateLessonIds.length > 0 && targetModuleId) {
      await cloneTemplateLessonsIntoModule(templateLessonIds.map(Number), Number(targetModuleId));
    } else if (templateId) {
      await cloneTemplateIntoOffering(templateId, courseId, {
        moduleIds: Array.isArray(moduleTemplateIds)
          ? moduleTemplateIds.filter((id) => typeof id === 'number').map(Number)
          : undefined,
        lessonIds: templateLessonIds.length > 0 ? templateLessonIds.map(Number) : undefined,
      });
    }

    if (Array.isArray(sourceLessonIds) && sourceLessonIds.length > 0) {
      if (!targetModuleId) {
        return res.status(400).json({ error: 'targetModuleId required when importing lessons' });
      }
      await cloneLessonsFromOffering(sourceLessonIds, Number(targetModuleId));
    }

    const updated = await prisma.courseOffering.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { position: 'asc' },
          include: {
            lessons: {
              orderBy: { position: 'asc' },
              include: {
                activities: { orderBy: { position: 'asc' } },
              },
            },
          },
        },
      },
    });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/courses/:courseId/modules', async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  try {
    const modules = await prisma.module.findMany({
      where: { courseOfferingId: courseId },
      orderBy: { position: 'asc' },
    });
    res.json(modules.map(mapModule));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/courses/:courseId/modules', requireRole('INSTRUCTOR'), async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  const { title, description, position } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });

  try {
    const module = await prisma.module.create({
      data: {
        title,
        description,
        position: typeof position === 'number' ? position : 0,
        courseOfferingId: courseId,
      },
    });
    res.status(201).json(mapModule(module));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/modules/:moduleId', async (req, res) => {
  const moduleId = Number(req.params.moduleId);
  if (!Number.isFinite(moduleId)) {
    return res.status(400).json({ error: 'Invalid module id' });
  }

  try {
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      include: { courseOffering: true },
    });
    if (!module) return res.status(404).json({ error: 'Module not found' });
    res.json({ ...mapModule(module), courseOfferingId: module.courseOfferingId });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/modules/:moduleId/lessons', async (req, res) => {
  const moduleId = Number(req.params.moduleId);
  if (!Number.isFinite(moduleId)) {
    return res.status(400).json({ error: 'Invalid module id' });
  }

  try {
    const lessons = await prisma.lesson.findMany({
      where: { moduleId },
      orderBy: { position: 'asc' },
    });
    res.json(lessons.map(mapLesson));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/modules/:moduleId/lessons', requireRole('INSTRUCTOR'), async (req, res) => {
  const moduleId = Number(req.params.moduleId);
  if (!Number.isFinite(moduleId)) {
    return res.status(400).json({ error: 'Invalid module id' });
  }

  const { title, contentMd, position } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });

  try {
    const lesson = await prisma.lesson.create({
      data: {
        title,
        contentMd: contentMd ?? '',
        position: typeof position === 'number' ? position : 0,
        moduleId,
      },
    });
    res.status(201).json(mapLesson(lesson));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/lessons/:lessonId', async (req, res) => {
  const lessonId = Number(req.params.lessonId);
  if (!Number.isFinite(lessonId)) {
    return res.status(400).json({ error: 'Invalid lesson id' });
  }

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    });
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json(mapLesson(lesson));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/lessons/:lessonId/activities', async (req, res) => {
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

app.post('/api/lessons/:lessonId/activities', requireRole('INSTRUCTOR'), async (req, res) => {
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
    activityTypeId,
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
        activityTypeId: activityTypeId ?? (await defaultActivityTypeId()),
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

let cachedDefaultActivityTypeId = null;
async function defaultActivityTypeId() {
  if (cachedDefaultActivityTypeId) return cachedDefaultActivityTypeId;
  const type = await prisma.activityType.findFirst({ where: { name: 'knowledge-check' } });
  if (!type) throw new Error('Default activity type not configured');
  cachedDefaultActivityTypeId = type.id;
  return type.id;
}

app.get('/api/activity-types', requireRole('INSTRUCTOR'), async (req, res) => {
  try {
    const activityTypes = await prisma.activityType.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(activityTypes);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/prompts', requireRole('INSTRUCTOR'), async (req, res) => {
  try {
    const prompts = await prisma.promptTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        activityType: { select: { id: true, name: true } },
      },
    });
    res.json(prompts);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/prompts', requireRole('INSTRUCTOR'), async (req, res) => {
  const {
    name,
    systemPrompt,
    userPrompt,
    activityTypeId,
    temperature,
    topP,
  } = req.body || {};

  if (!name || !systemPrompt || !userPrompt) {
    return res.status(400).json({ error: 'name, systemPrompt, and userPrompt are required' });
  }

  let resolvedActivityTypeId = null;
  try {
    if (typeof activityTypeId === 'number') {
      const exists = await prisma.activityType.findUnique({ where: { id: activityTypeId } });
      if (!exists) {
        return res.status(400).json({ error: 'Invalid activityTypeId' });
      }
      resolvedActivityTypeId = activityTypeId;
    } else {
      resolvedActivityTypeId = await defaultActivityTypeId();
    }
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }

  try {
    const prompt = await prisma.promptTemplate.create({
      data: {
        name,
        systemPrompt,
        userPrompt,
        activityTypeId: resolvedActivityTypeId,
        temperature: typeof temperature === 'number' ? temperature : null,
        topP: typeof topP === 'number' ? topP : null,
      },
      include: {
        activityType: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(prompt);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch('/api/activities/:activityId', requireRole('INSTRUCTOR'), async (req, res) => {
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

app.post('/api/questions/:id/answer', async (req, res) => {
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
