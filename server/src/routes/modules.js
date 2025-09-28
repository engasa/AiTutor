import express from 'express';
import { prisma } from '../config/database.js';
import { requireRole } from '../middleware/auth.js';
import { mapModule } from '../utils/mappers.js';

const router = express.Router();

router.get('/courses/:courseId/modules', async (req, res) => {
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

router.post('/courses/:courseId/modules', requireRole('INSTRUCTOR'), async (req, res) => {
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

router.get('/modules/:moduleId', async (req, res) => {
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

export default router;