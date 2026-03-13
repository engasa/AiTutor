import express from 'express';
import { prisma } from '../config/database.js';
import { requireRole } from '../middleware/auth.js';
import { getEduAiAccessTokenForUser } from '../services/eduaiAuth.js';
import { syncExternalCourseTopics } from '../services/topicSync.js';

const router = express.Router();

async function ensureCourseAccess(courseId, userId) {
  const course = await prisma.courseOffering.findUnique({
    where: { id: courseId },
    include: {
      instructors: true,
      enrollments: true,
    },
  });

  if (!course) {
    return { course: null, authorized: false };
  }

  const isInstructor = course.instructors.some((assignment) => assignment.userId === userId);
  const isStudent = course.enrollments.some((enrollment) => enrollment.userId === userId);

  return { course, authorized: isInstructor || isStudent, isInstructor };
}

router.get('/courses/:courseId/topics', async (req, res) => {
  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { course, authorized } = await ensureCourseAccess(courseId, req.user.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (!authorized) {
      return res.status(403).json({ error: 'Not authorized for this course' });
    }

    // Do not auto-sync here to avoid surprising UI changes.
    // Imported courses can be synced explicitly via the sync endpoint.

    const topics = await prisma.topic.findMany({
      where: { courseOfferingId: courseId },
      orderBy: { name: 'asc' },
    });
    res.json(topics);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/courses/:courseId/topics', requireRole('PROFESSOR'), async (req, res) => {
  const instructor = req.user;
  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const { course, isInstructor } = await ensureCourseAccess(courseId, instructor.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (!isInstructor) {
      return res.status(403).json({ error: 'Not authorized for this course' });
    }

    // Block manual topic creation for imported (external) courses
    if (course.externalId) {
      return res
        .status(403)
        .json({ error: 'Topics for imported courses are managed by EduAI and cannot be added here' });
    }

    const topic = await prisma.topic.create({
      data: {
        name,
        courseOfferingId: courseId,
      },
    });

    res.status(201).json(topic);
  } catch (e) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'Topic name already exists for this course' });
    }
    res.status(500).json({ error: String(e) });
  }
});

export default router;

// Sync topics from EduAI for an imported course (instructor only)
router.post('/courses/:courseId/topics/sync', requireRole('PROFESSOR'), async (req, res) => {
  const instructor = req.user;
  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  try {
    const course = await prisma.courseOffering.findUnique({
      where: { id: courseId },
      include: { instructors: { select: { userId: true } } },
    });
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const isInstructor = course.instructors.some((i) => i.userId === instructor.id);
    if (!isInstructor) {
      return res.status(403).json({ error: 'Not authorized for this course' });
    }

    if (!course.externalId) {
      return res.status(400).json({ error: 'Course is not imported from EduAI' });
    }

    let upstreamNames = [];
    try {
      const eduAiAccessToken = await getEduAiAccessTokenForUser(instructor.id);
      const { topics: synced, upstreamNames: upstream } = await syncExternalCourseTopics(courseId, {
        accessToken: eduAiAccessToken,
      });
      upstreamNames = upstream || [];
    } catch (e) {
      const status = Number.isInteger(e?.status) ? e.status : 502;
      return res.status(status).json({ error: e?.message || 'Failed to sync topics from EduAI' });
    }

    const topics = await prisma.topic.findMany({
      where: { courseOfferingId: courseId },
      orderBy: { name: 'asc' },
    });
    const upstreamSet = new Set(upstreamNames);
    const missingTopics = topics.filter((t) => !upstreamSet.has(t.name));
    res.json({ ok: true, topics, missingTopics });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Remap activities from one topic to another and remove the old topic
router.post('/courses/:courseId/topics/remap', requireRole('PROFESSOR'), async (req, res) => {
  const instructor = req.user;
  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  const mappings = Array.isArray(req.body?.mappings) ? req.body.mappings : [];
  const normalized = mappings
    .map((m) => ({ fromTopicId: Number(m?.fromTopicId), toTopicId: Number(m?.toTopicId) }))
    .filter((m) => Number.isFinite(m.fromTopicId) && Number.isFinite(m.toTopicId) && m.fromTopicId !== m.toTopicId);

  if (normalized.length === 0) {
    return res.status(400).json({ error: 'No valid mappings provided' });
  }

  try {
    const course = await prisma.courseOffering.findUnique({
      where: { id: courseId },
      include: { instructors: { select: { userId: true } } },
    });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const isInstructor = course.instructors.some((i) => i.userId === instructor.id);
    if (!isInstructor) return res.status(403).json({ error: 'Not authorized for this course' });

    await prisma.$transaction(async (tx) => {
      for (const { fromTopicId, toTopicId } of normalized) {
        // Validate topics belong to this course
        const [fromTopic, toTopic] = await Promise.all([
          tx.topic.findUnique({ where: { id: fromTopicId } }),
          tx.topic.findUnique({ where: { id: toTopicId } }),
        ]);
        if (!fromTopic || fromTopic.courseOfferingId !== courseId) {
          throw new Error('fromTopicId does not belong to this course');
        }
        if (!toTopic || toTopic.courseOfferingId !== courseId) {
          throw new Error('toTopicId does not belong to this course');
        }

        // Reassign main topics
        await tx.activity.updateMany({
          where: {
            mainTopicId: fromTopicId,
            lesson: { module: { courseOfferingId: courseId } },
          },
          data: { mainTopicId: toTopicId },
        });

        // Reassign secondary topics: create missing target relations, then delete old relations
        const secondary = await tx.activitySecondaryTopic.findMany({
          where: {
            topicId: fromTopicId,
            activity: { lesson: { module: { courseOfferingId: courseId } } },
          },
          select: { activityId: true },
        });
        const activityIds = Array.from(new Set(secondary.map((s) => s.activityId)));

        if (activityIds.length > 0) {
          // Create missing target relations
          const existingTarget = await tx.activitySecondaryTopic.findMany({
            where: { topicId: toTopicId, activityId: { in: activityIds } },
            select: { activityId: true },
          });
          const have = new Set(existingTarget.map((e) => e.activityId));
          const toCreate = activityIds.filter((id) => !have.has(id));
          if (toCreate.length > 0) {
            await tx.activitySecondaryTopic.createMany({
              data: toCreate.map((id) => ({ activityId: id, topicId: toTopicId })),
              skipDuplicates: true,
            });
          }

          // Remove old relations
          await tx.activitySecondaryTopic.deleteMany({
            where: { topicId: fromTopicId, activityId: { in: activityIds } },
          });
        }

        // Attempt to delete the old topic now that it’s unused
        try {
          await tx.topic.delete({ where: { id: fromTopicId } });
        } catch (_) {
          // If still referenced somehow, leave it.
        }
      }
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
