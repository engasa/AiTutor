import express from 'express';
import { prisma } from '../config/database.js';
import { requireRole } from '../middleware/auth.js';
import { mapCourseOffering, mapProgressData } from '../utils/mappers.js';
import { cloneCourseContent, cloneLessonsFromOffering } from '../services/courseCloning.js';
import { calculateCourseProgress } from '../services/progressCalculation.js';

const router = express.Router();

router.get('/courses', async (req, res) => {
  const authUser = req.user;
  if (!authUser) return res.status(401).json({ error: 'Authentication required' });

  try {
    if (authUser.role === 'INSTRUCTOR') {
      // Instructors see all their courses regardless of publish status (no progress)
      const courses = await prisma.courseOffering.findMany({
        where: { instructors: { some: { userId: authUser.id } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(courses.map(mapCourseOffering));
    } else {
      // Students only see published courses they're enrolled in (with progress)
      const courses = await prisma.courseOffering.findMany({
        where: {
          enrollments: { some: { userId: authUser.id } },
          isPublished: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Calculate progress for each course
      const coursesWithProgress = await Promise.all(
        courses.map(async (course) => {
          const progress = await calculateCourseProgress(course.id, authUser.id);
          return {
            ...mapCourseOffering(course),
            progress: mapProgressData(progress),
          };
        }),
      );

      res.json(coursesWithProgress);
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/courses/:courseId', async (req, res) => {
  const authUser = req.user;
  if (!authUser) return res.status(401).json({ error: 'Authentication required' });

  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  try {
    const course = await prisma.courseOffering.findUnique({
      where: { id: courseId },
      include: {
        instructors: { select: { userId: true } },
        enrollments: { select: { userId: true } },
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const isInstructor = course.instructors.some((i) => i.userId === authUser.id);
    const isStudent = course.enrollments.some((e) => e.userId === authUser.id);

    if (!isInstructor && !isStudent) {
      return res.status(403).json({ error: 'Not authorized for this course' });
    }

    res.json(mapCourseOffering(course));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/courses', requireRole('INSTRUCTOR'), async (req, res) => {
  const instructor = req.user;
  const {
    title,
    description,
    sourceCourseId,
    startDate,
    endDate,
  } = req.body || {};

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const numericSourceCourseId =
    typeof sourceCourseId === 'number' || typeof sourceCourseId === 'string'
      ? Number(sourceCourseId)
      : null;

  if (numericSourceCourseId !== null && !Number.isFinite(numericSourceCourseId)) {
    return res.status(400).json({ error: 'Invalid sourceCourseId' });
  }

  try {
    if (numericSourceCourseId !== null) {
      const instructorAssignment = await prisma.courseInstructor.findFirst({
        where: { courseOfferingId: numericSourceCourseId, userId: instructor.id },
      });

      if (!instructorAssignment) {
        return res.status(403).json({ error: 'Not authorized for source course' });
      }
    }

    const offering = await prisma.courseOffering.create({
      data: {
        title,
        description,
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

    if (numericSourceCourseId !== null) {
      await cloneCourseContent(numericSourceCourseId, offering.id);
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

router.patch('/courses/:courseId', requireRole('INSTRUCTOR'), async (req, res) => {
  const instructor = req.user;
  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  const { title, description, startDate, endDate } = req.body || {};

  if (!title && !description && !startDate && !endDate) {
    return res.status(400).json({ error: 'Nothing to update' });
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

router.post('/courses/:courseId/import', requireRole('INSTRUCTOR'), async (req, res) => {
  const instructor = req.user;
  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  const {
    sourceCourseId,
    moduleIds,
    lessonIds,
    targetModuleId,
  } = req.body || {};

  const normalizedModuleIds = Array.isArray(moduleIds)
    ? moduleIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    : [];

  const normalizedLessonIds = Array.isArray(lessonIds)
    ? lessonIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    : [];

  const numericTargetModuleId =
    typeof targetModuleId === 'number' || typeof targetModuleId === 'string'
      ? Number(targetModuleId)
      : null;

  const numericSourceCourseId =
    typeof sourceCourseId === 'number' || typeof sourceCourseId === 'string'
      ? Number(sourceCourseId)
      : null;

  if (numericSourceCourseId !== null && !Number.isFinite(numericSourceCourseId)) {
    return res.status(400).json({ error: 'Invalid sourceCourseId' });
  }

  if (normalizedModuleIds.length === 0 && normalizedLessonIds.length === 0) {
    return res.status(400).json({ error: 'Nothing to import' });
  }

  try {
    const instructorAssignment = await prisma.courseInstructor.findFirst({
      where: { courseOfferingId: courseId, userId: instructor.id },
    });
    if (!instructorAssignment) {
      return res.status(403).json({ error: 'Not authorized for this course' });
    }

    if (normalizedModuleIds.length > 0) {
      if (numericSourceCourseId === null) {
        return res.status(400).json({ error: 'sourceCourseId required when importing modules' });
      }

      const sourceAccess = await prisma.courseInstructor.findFirst({
        where: { courseOfferingId: numericSourceCourseId, userId: instructor.id },
      });
      if (!sourceAccess) {
        return res.status(403).json({ error: 'Not authorized for source course' });
      }

      const moduleCount = await prisma.module.count({
        where: {
          id: { in: normalizedModuleIds },
          courseOfferingId: numericSourceCourseId,
        },
      });

      if (moduleCount !== normalizedModuleIds.length) {
        return res.status(400).json({ error: 'One or more modules do not belong to source course' });
      }

      await cloneCourseContent(numericSourceCourseId, courseId, {
        moduleIds: normalizedModuleIds,
      });
    }

    if (normalizedLessonIds.length > 0) {
      if (numericTargetModuleId === null || !Number.isFinite(numericTargetModuleId)) {
        return res.status(400).json({ error: 'targetModuleId required when importing lessons' });
      }

      const targetModule = await prisma.module.findUnique({
        where: { id: numericTargetModuleId },
        select: { courseOfferingId: true },
      });

      if (!targetModule || targetModule.courseOfferingId !== courseId) {
        return res.status(400).json({ error: 'targetModuleId does not belong to destination course' });
      }

      const lessons = await prisma.lesson.findMany({
        where: { id: { in: normalizedLessonIds } },
        include: {
          module: { select: { courseOfferingId: true } },
        },
      });

      if (lessons.length !== normalizedLessonIds.length) {
        return res.status(400).json({ error: 'One or more lessons were not found' });
      }

      const sourceCourseIds = new Set(lessons.map((lesson) => lesson.module.courseOfferingId));

      for (const course of sourceCourseIds) {
        const assignment = await prisma.courseInstructor.findFirst({
          where: { courseOfferingId: course, userId: instructor.id },
        });
        if (!assignment) {
          return res.status(403).json({ error: 'Not authorized for lesson source course' });
        }
      }

      await cloneLessonsFromOffering(normalizedLessonIds, numericTargetModuleId);
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

// Publish a course (no restrictions, no cascading)
router.patch('/courses/:courseId/publish', requireRole('INSTRUCTOR'), async (req, res) => {
  const instructor = req.user;
  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
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
      data: { isPublished: true },
    });

    res.json(mapCourseOffering(updated));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Unpublish a course (cascades to all modules and lessons)
router.patch('/courses/:courseId/unpublish', requireRole('INSTRUCTOR'), async (req, res) => {
  const instructor = req.user;
  const courseId = Number(req.params.courseId);
  if (!Number.isFinite(courseId)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  try {
    const instructorAssignment = await prisma.courseInstructor.findFirst({
      where: { courseOfferingId: courseId, userId: instructor.id },
    });
    if (!instructorAssignment) {
      return res.status(403).json({ error: 'Not authorized for this course' });
    }

    // Unpublish course and cascade to all modules and lessons
    await prisma.$transaction(async (tx) => {
      // Update the course
      await tx.courseOffering.update({
        where: { id: courseId },
        data: { isPublished: false },
      });

      // Update all modules in this course
      await tx.module.updateMany({
        where: { courseOfferingId: courseId },
        data: { isPublished: false },
      });

      // Update all lessons in modules of this course
      const modules = await tx.module.findMany({
        where: { courseOfferingId: courseId },
        select: { id: true },
      });
      const moduleIds = modules.map((m) => m.id);

      if (moduleIds.length > 0) {
        await tx.lesson.updateMany({
          where: { moduleId: { in: moduleIds } },
          data: { isPublished: false },
        });
      }
    });

    const updated = await prisma.courseOffering.findUnique({
      where: { id: courseId },
    });

    res.json(mapCourseOffering(updated));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;