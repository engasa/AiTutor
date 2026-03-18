import { prisma } from '../config/database.js';

async function ensureTopicMapping(tx, options) {
  const { sourceTopicId, sourceTopicById, topicIdMap, targetTopicsByName, targetCourseId } =
    options;
  if (!sourceTopicId) return null;
  if (topicIdMap.has(sourceTopicId)) {
    return topicIdMap.get(sourceTopicId);
  }

  const sourceTopic = sourceTopicById.get(sourceTopicId);
  if (!sourceTopic) {
    return null;
  }

  let targetTopic = targetTopicsByName.get(sourceTopic.name);
  if (!targetTopic) {
    targetTopic = await tx.topic.create({
      data: {
        name: sourceTopic.name,
        courseOfferingId: targetCourseId,
      },
    });
    targetTopicsByName.set(sourceTopic.name, targetTopic);
  }

  topicIdMap.set(sourceTopicId, targetTopic.id);
  return targetTopic.id;
}

export async function cloneCourseContent(sourceCourseId, targetCourseId, options = {}) {
  const { moduleIds = null } = options;

  const sourceModules = await prisma.module.findMany({
    where: {
      courseOfferingId: sourceCourseId,
      ...(Array.isArray(moduleIds) && moduleIds.length > 0 ? { id: { in: moduleIds } } : {}),
    },
    orderBy: { position: 'asc' },
    include: {
      lessons: {
        orderBy: { position: 'asc' },
        include: {
          activities: {
            orderBy: { position: 'asc' },
            include: { secondaryTopics: true },
          },
        },
      },
    },
  });

  if (sourceModules.length === 0) return;

  const sourceTopics = await prisma.topic.findMany({
    where: { courseOfferingId: sourceCourseId },
  });
  const sourceTopicById = new Map(sourceTopics.map((topic) => [topic.id, topic]));

  const maxPosition = await prisma.module.aggregate({
    where: { courseOfferingId: targetCourseId },
    _max: { position: true },
  });
  let nextModulePosition = maxPosition._max.position ?? 0;

  await prisma.$transaction(async (tx) => {
    const existingTargetTopics = await tx.topic.findMany({
      where: { courseOfferingId: targetCourseId },
    });
    const targetTopicsByName = new Map(existingTargetTopics.map((topic) => [topic.name, topic]));
    const topicIdMap = new Map();

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
          const targetMainTopicId = await ensureTopicMapping(tx, {
            sourceTopicId: activity.mainTopicId,
            sourceTopicById,
            topicIdMap,
            targetTopicsByName,
            targetCourseId,
          });

          if (!targetMainTopicId) {
            throw new Error('Failed to map main topic while cloning activity.');
          }

          const mappedSecondaryIds = [];
          for (const relation of activity.secondaryTopics) {
            const mapped = await ensureTopicMapping(tx, {
              sourceTopicId: relation.topicId,
              sourceTopicById,
              topicIdMap,
              targetTopicsByName,
              targetCourseId,
            });
            if (mapped) {
              mappedSecondaryIds.push(mapped);
            }
          }

          await tx.activity.create({
            data: {
              title: activity.title,
              instructionsMd: activity.instructionsMd,
              position: activity.position,
              lessonId: createdLesson.id,
              promptTemplateId: activity.promptTemplateId,
              config: activity.config,
              mainTopicId: targetMainTopicId,
              secondaryTopics:
                mappedSecondaryIds.length > 0
                  ? {
                      create: mappedSecondaryIds.map((topicId) => ({
                        topic: { connect: { id: topicId } },
                      })),
                    }
                  : undefined,
            },
          });
        }
      }
    }
  });
}

export async function cloneLessonsFromOffering(sourceLessonIds, targetModuleId) {
  const targetModule = await prisma.module.findUnique({
    where: { id: targetModuleId },
    select: { courseOfferingId: true },
  });
  if (!targetModule) return;

  const lessons = await prisma.lesson.findMany({
    where: { id: { in: sourceLessonIds } },
    orderBy: { position: 'asc' },
    include: {
      module: { select: { courseOfferingId: true } },
      activities: {
        orderBy: { position: 'asc' },
        include: { secondaryTopics: true },
      },
    },
  });

  if (lessons.length === 0) return;

  const sourceCourseIds = new Set(
    lessons
      .map((lesson) => lesson.module.courseOfferingId)
      .filter((value) => Number.isInteger(value)),
  );

  const sourceTopicById = new Map();
  for (const courseId of sourceCourseIds) {
    const topics = await prisma.topic.findMany({ where: { courseOfferingId: courseId } });
    for (const topic of topics) {
      sourceTopicById.set(topic.id, topic);
    }
  }

  const maxPosition = await prisma.lesson.aggregate({
    where: { moduleId: targetModuleId },
    _max: { position: true },
  });
  let nextLessonPosition = maxPosition._max.position ?? 0;

  await prisma.$transaction(async (tx) => {
    const existingTargetTopics = await tx.topic.findMany({
      where: { courseOfferingId: targetModule.courseOfferingId },
    });
    const targetTopicsByName = new Map(existingTargetTopics.map((topic) => [topic.name, topic]));
    const topicIdMap = new Map();

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
        const targetMainTopicId = await ensureTopicMapping(tx, {
          sourceTopicId: activity.mainTopicId,
          sourceTopicById,
          topicIdMap,
          targetTopicsByName,
          targetCourseId: targetModule.courseOfferingId,
        });

        if (!targetMainTopicId) {
          throw new Error('Failed to map main topic while cloning activity.');
        }

        const mappedSecondaryIds = [];
        for (const relation of activity.secondaryTopics) {
          const mapped = await ensureTopicMapping(tx, {
            sourceTopicId: relation.topicId,
            sourceTopicById,
            topicIdMap,
            targetTopicsByName,
            targetCourseId: targetModule.courseOfferingId,
          });
          if (mapped) {
            mappedSecondaryIds.push(mapped);
          }
        }

        await tx.activity.create({
          data: {
            title: activity.title,
            instructionsMd: activity.instructionsMd,
            position: activity.position,
            lessonId: createdLesson.id,
            promptTemplateId: activity.promptTemplateId,
            config: activity.config,
            mainTopicId: targetMainTopicId,
            secondaryTopics:
              mappedSecondaryIds.length > 0
                ? {
                    create: mappedSecondaryIds.map((topicId) => ({
                      topic: { connect: { id: topicId } },
                    })),
                  }
                : undefined,
          },
        });
      }
    }
  });
}
