import express from 'express';
import { prisma } from '../config/database.js';
import { requireRole } from '../middleware/auth.js';
import { mapLesson } from '../utils/mappers.js';

const router = express.Router();

router.get('/modules/:moduleId/lessons', async (req, res) => {
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

export default router;