import express from 'express';
import { prisma } from '../config/database.js';
import { requireRole } from '../middleware/auth.js';
import { mapLesson, mapProgressData } from '../utils/mappers.js';
import { calculateLessonProgress, calculateMultiLessonProgress } from '../services/progressCalculation.js';

const router = express.Router();

router.get('/modules/:moduleId/lessons', async (req, res) => {
  const authUser = req.user;
  const moduleId = Number(req.params.moduleId);
  if (!Number.isFinite(moduleId)) {
    return res.status(400).json({ error: 'Invalid module id' });
  }

  try {
    // Students only see published lessons
    const whereClause =
      authUser && authUser.role === 'STUDENT'
        ? { moduleId, isPublished: true }
        : { moduleId };

    const lessons = await prisma.lesson.findMany({
      where: whereClause,
      orderBy: { position: 'asc' },
    });

    // For students, add progress to each lesson using batch calculation (N+1 fix)
    if (authUser && authUser.role === 'STUDENT') {
      const lessonIds = lessons.map((l) => l.id);
      const progressMap = await calculateMultiLessonProgress(lessonIds, authUser.id);

      const lessonsWithProgress = lessons.map((lesson) => {
        const progress = progressMap.get(lesson.id) || { completed: 0, total: 0, percentage: 0 };
        return {
          ...mapLesson(lesson),
          progress: mapProgressData(progress),
        };
      });
      res.json(lessonsWithProgress);
    } else {
      res.json(lessons.map(mapLesson));
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/modules/:moduleId/lessons', requireRole('INSTRUCTOR'), async (req, res) => {
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

router.get('/lessons/:lessonId', async (req, res) => {
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

// Publish a lesson (requires parent module AND course to be published)
router.patch('/lessons/:lessonId/publish', requireRole('INSTRUCTOR'), async (req, res) => {
  const instructor = req.user;
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
              include: { instructors: { select: { userId: true } } },
            },
          },
        },
      },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const isInstructor = lesson.module.courseOffering.instructors.some((i) => i.userId === instructor.id);
    if (!isInstructor) {
      return res.status(403).json({ error: 'Not authorized for this lesson' });
    }

    // Validate parent course is published
    if (!lesson.module.courseOffering.isPublished) {
      return res.status(400).json({
        error: 'Cannot publish lesson: parent course is not published'
      });
    }

    // Validate parent module is published
    if (!lesson.module.isPublished) {
      return res.status(400).json({
        error: 'Cannot publish lesson: parent module is not published'
      });
    }

    const updated = await prisma.lesson.update({
      where: { id: lessonId },
      data: { isPublished: true },
    });

    res.json(mapLesson(updated));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Unpublish a lesson (no cascading, lessons have no children)
router.patch('/lessons/:lessonId/unpublish', requireRole('INSTRUCTOR'), async (req, res) => {
  const instructor = req.user;
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
              include: { instructors: { select: { userId: true } } },
            },
          },
        },
      },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const isInstructor = lesson.module.courseOffering.instructors.some((i) => i.userId === instructor.id);
    if (!isInstructor) {
      return res.status(403).json({ error: 'Not authorized for this lesson' });
    }

    const updated = await prisma.lesson.update({
      where: { id: lessonId },
      data: { isPublished: false },
    });

    res.json(mapLesson(updated));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;