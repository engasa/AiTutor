import { prisma } from '../config/database.js';

export async function cloneCourseContent(sourceCourseId, targetCourseId, options = {}) {
  const { moduleIds = null } = options;

  const sourceModules = await prisma.module.findMany({
    where: {
      courseOfferingId: sourceCourseId,
      ...(Array.isArray(moduleIds) && moduleIds.length > 0
        ? { id: { in: moduleIds } }
        : {}),
    },
    orderBy: { position: 'asc' },
    include: {
      lessons: {
        orderBy: { position: 'asc' },
        include: {
          activities: { orderBy: { position: 'asc' } },
        },
      },
    },
  });

  if (sourceModules.length === 0) return;

  const maxPosition = await prisma.module.aggregate({
    where: { courseOfferingId: targetCourseId },
    _max: { position: true },
  });
  let nextModulePosition = maxPosition._max.position ?? 0;

  await prisma.$transaction(async (tx) => {
    for (const module of sourceModules) {
      nextModulePosition += 1;
      const createdModule = await tx.module.create({
        data: {
          title: module.title,
          description: module.description,
          position: nextModulePosition,
          courseOfferingId: targetCourseId,
        },
      });

      for (const lesson of module.lessons) {
        const createdLesson = await tx.lesson.create({
          data: {
            title: lesson.title,
            contentMd: lesson.contentMd,
            position: lesson.position,
            moduleId: createdModule.id,
          },
        });

        for (const activity of lesson.activities) {
          await tx.activity.create({
            data: {
              title: activity.title,
              instructionsMd: activity.instructionsMd,
              position: activity.position,
              lessonId: createdLesson.id,
              promptTemplateId: activity.promptTemplateId,
              config: activity.config,
            },
          });
        }
      }
    }
  });
}

export async function cloneLessonsFromOffering(sourceLessonIds, targetModuleId) {
  const lessons = await prisma.lesson.findMany({
    where: { id: { in: sourceLessonIds } },
    orderBy: { position: 'asc' },
    include: { activities: { orderBy: { position: 'asc' } } },
  });

  if (lessons.length === 0) return;

  const maxPosition = await prisma.lesson.aggregate({
    where: { moduleId: targetModuleId },
    _max: { position: true },
  });
  let nextLessonPosition = maxPosition._max.position ?? 0;

  await prisma.$transaction(async (tx) => {
    for (const lesson of lessons) {
      nextLessonPosition += 1;
      const createdLesson = await tx.lesson.create({
        data: {
          title: lesson.title,
          contentMd: lesson.contentMd,
          position: nextLessonPosition,
          moduleId: targetModuleId,
        },
      });

      for (const activity of lesson.activities) {
        await tx.activity.create({
          data: {
            title: activity.title,
            instructionsMd: activity.instructionsMd,
            position: activity.position,
            lessonId: createdLesson.id,
            promptTemplateId: activity.promptTemplateId,
            config: activity.config,
          },
        });
      }
    }
  });
}