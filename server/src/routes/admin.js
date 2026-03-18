import express from 'express';
import { prisma } from '../config/database.js';
import { requireRole } from '../middleware/auth.js';
import {
  SYSTEM_SETTING_KEYS,
  clearSystemSetting,
  getEduAiApiKeyStatus,
  setSystemSetting,
} from '../services/systemSettings.js';
import { getAiModelPolicyState, setAiModelPolicy } from '../services/aiModelPolicy.js';
import { mapAdminUser, mapCourseOffering } from '../utils/mappers.js';

const router = express.Router();

router.get('/admin/users', requireRole('ADMIN'), async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    res.json(users.map(mapAdminUser));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.patch('/admin/users/:userId/role', requireRole('ADMIN'), async (req, res) => {
  return res.status(410).json({ error: 'Roles are managed in EduAI' });
});

router.get('/admin/courses', requireRole('ADMIN'), async (_req, res) => {
  try {
    const courses = await prisma.courseOffering.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    res.json(courses.map(mapCourseOffering));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/admin/courses/:courseId/enrollments', requireRole('ADMIN'), async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  try {
    const course = await prisma.courseOffering.findUnique({
      where: { id: courseId },
      include: {
        enrollments: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const enrolledIds = course.enrollments.map((enrollment) => enrollment.userId);
    const availableStudents = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        id: { notIn: enrolledIds.length > 0 ? enrolledIds : undefined },
      },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });

    res.json({
      courseId,
      enrolledStudents: course.enrollments
        .map((enrollment) => enrollment.user)
        .toSorted((a, b) => a.name.localeCompare(b.name))
        .map(mapAdminUser),
      availableStudents: availableStudents.map(mapAdminUser),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/admin/courses/:courseId/enrollments', requireRole('ADMIN'), async (req, res) => {
  const courseId = Number(req.params.courseId);
  const userId =
    typeof req.body?.userId === 'string' && req.body.userId.trim().length > 0
      ? req.body.userId.trim()
      : null;

  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  try {
    const [course, user] = await Promise.all([
      prisma.courseOffering.findUnique({ where: { id: courseId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (!user || user.role !== 'STUDENT') {
      return res.status(400).json({ error: 'Only student users can be enrolled' });
    }

    await prisma.courseEnrollment.upsert({
      where: {
        courseOfferingId_userId: {
          courseOfferingId: courseId,
          userId,
        },
      },
      update: {},
      create: {
        courseOfferingId: courseId,
        userId,
      },
    });

    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete(
  '/admin/courses/:courseId/enrollments/:userId',
  requireRole('ADMIN'),
  async (req, res) => {
    const courseId = Number(req.params.courseId);
    const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';

    if (!Number.isFinite(courseId)) {
      return res.status(400).json({ error: 'Invalid course id' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    try {
      await prisma.courseEnrollment.deleteMany({
        where: {
          courseOfferingId: courseId,
          userId,
        },
      });

      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  },
);

router.get('/admin/settings/eduai-api-key', requireRole('ADMIN'), async (req, res) => {
  try {
    const status = await getEduAiApiKeyStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.put('/admin/settings/eduai-api-key', requireRole('ADMIN'), async (req, res) => {
  const apiKey = req.body?.apiKey;
  if (typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'apiKey must be a string' });
  }

  const trimmed = apiKey.trim();
  if (!trimmed) {
    return res.status(400).json({ error: 'apiKey cannot be empty' });
  }

  try {
    await setSystemSetting(SYSTEM_SETTING_KEYS.EDUAI_API_KEY, trimmed);
    const status = await getEduAiApiKeyStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete('/admin/settings/eduai-api-key', requireRole('ADMIN'), async (req, res) => {
  try {
    await clearSystemSetting(SYSTEM_SETTING_KEYS.EDUAI_API_KEY);
    const status = await getEduAiApiKeyStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/admin/settings/ai-model-policy', requireRole('ADMIN'), async (_req, res) => {
  try {
    const state = await getAiModelPolicyState();
    res.json(state);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.put('/admin/settings/ai-model-policy', requireRole('ADMIN'), async (req, res) => {
  try {
    const state = await setAiModelPolicy(req.body || {});
    res.json(state);
  } catch (e) {
    const status = Number.isInteger(e?.status)
      ? e.status
      : e?.message?.includes('must') || e?.message?.includes('At least one')
        ? 400
        : 500;
    res.status(status).json({ error: String(e.message || e) });
  }
});

export default router;
