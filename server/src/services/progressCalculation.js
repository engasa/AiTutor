import { prisma } from '../config/database.js';

/**
 * Calculate progress for multiple courses in a single batch query
 * This is much more efficient than calling calculateCourseProgress repeatedly
 */
export async function calculateMultiCourseProgress(courseIds, userId) {
  if (!courseIds || courseIds.length === 0 || !userId) {
    return new Map();
  }

  try {
    // Get all published activities grouped by course
    const activities = await prisma.activity.findMany({
      where: {
        lesson: {
          isPublished: true,
          module: {
            isPublished: true,
            courseOfferingId: { in: courseIds },
          },
        },
      },
      select: {
        id: true,
        lesson: {
          select: {
            module: {
              select: { courseOfferingId: true },
            },
          },
        },
      },
    });

    // Group activities by course
    const activitiesByCourse = new Map();
    for (const activity of activities) {
      const courseId = activity.lesson.module.courseOfferingId;
      if (!activitiesByCourse.has(courseId)) {
        activitiesByCourse.set(courseId, []);
      }
      activitiesByCourse.get(courseId).push(activity.id);
    }

    // Get all activity IDs
    const allActivityIds = activities.map((a) => a.id);

    // Batch fetch completion statuses for all activities
    const completionMap = await getCompletionCountsByActivity(allActivityIds, userId);

    // Calculate progress for each course
    const progressByCourse = new Map();
    for (const courseId of courseIds) {
      const activityIds = activitiesByCourse.get(courseId) || [];
      const totalActivities = activityIds.length;

      if (totalActivities === 0) {
        progressByCourse.set(courseId, { completed: 0, total: 0, percentage: 0 });
        continue;
      }

      const completedCount = activityIds.filter((actId) => completionMap.get(actId) === true).length;

      progressByCourse.set(courseId, {
        completed: completedCount,
        total: totalActivities,
        percentage: Math.round((completedCount / totalActivities) * 100),
      });
    }

    return progressByCourse;
  } catch (error) {
    console.error('Error calculating multi-course progress:', error);
    return new Map();
  }
}

/**
 * Calculate progress for a course based on correct submissions
 * Progress = (# activities with correct latest submission) / (# published activities)
 * Only counts activities in published lessons in published modules
 */
export async function calculateCourseProgress(courseId, userId) {
  if (!courseId || !userId) {
    return { completed: 0, total: 0, percentage: 0 };
  }

  const progressMap = await calculateMultiCourseProgress([courseId], userId);
  return progressMap.get(courseId) || { completed: 0, total: 0, percentage: 0 };
}

/**
 * Calculate progress for multiple modules in a single batch query
 * This is much more efficient than calling calculateModuleProgress repeatedly
 */
export async function calculateMultiModuleProgress(moduleIds, userId) {
  if (!moduleIds || moduleIds.length === 0 || !userId) {
    return new Map();
  }

  try {
    // Get all published activities grouped by module
    const activities = await prisma.activity.findMany({
      where: {
        lesson: {
          isPublished: true,
          moduleId: { in: moduleIds },
        },
      },
      select: {
        id: true,
        lesson: {
          select: { moduleId: true },
        },
      },
    });

    // Group activities by module
    const activitiesByModule = new Map();
    for (const activity of activities) {
      const moduleId = activity.lesson.moduleId;
      if (!activitiesByModule.has(moduleId)) {
        activitiesByModule.set(moduleId, []);
      }
      activitiesByModule.get(moduleId).push(activity.id);
    }

    // Get all activity IDs
    const allActivityIds = activities.map((a) => a.id);

    // Batch fetch completion statuses for all activities
    const completionMap = await getCompletionCountsByActivity(allActivityIds, userId);

    // Calculate progress for each module
    const progressByModule = new Map();
    for (const moduleId of moduleIds) {
      const activityIds = activitiesByModule.get(moduleId) || [];
      const totalActivities = activityIds.length;

      if (totalActivities === 0) {
        progressByModule.set(moduleId, { completed: 0, total: 0, percentage: 0 });
        continue;
      }

      const completedCount = activityIds.filter((actId) => completionMap.get(actId) === true).length;

      progressByModule.set(moduleId, {
        completed: completedCount,
        total: totalActivities,
        percentage: Math.round((completedCount / totalActivities) * 100),
      });
    }

    return progressByModule;
  } catch (error) {
    console.error('Error calculating multi-module progress:', error);
    return new Map();
  }
}

/**
 * Calculate progress for a module based on correct submissions
 * Only counts activities in published lessons
 */
export async function calculateModuleProgress(moduleId, userId) {
  if (!moduleId || !userId) {
    return { completed: 0, total: 0, percentage: 0 };
  }

  const progressMap = await calculateMultiModuleProgress([moduleId], userId);
  return progressMap.get(moduleId) || { completed: 0, total: 0, percentage: 0 };
}

/**
 * Calculate progress for multiple lessons in a single batch query
 * This is much more efficient than calling calculateLessonProgress repeatedly
 */
export async function calculateMultiLessonProgress(lessonIds, userId) {
  if (!lessonIds || lessonIds.length === 0 || !userId) {
    return new Map();
  }

  try {
    // Get all activities grouped by lesson
    const activities = await prisma.activity.findMany({
      where: {
        lessonId: { in: lessonIds },
      },
      select: {
        id: true,
        lessonId: true,
      },
    });

    // Group activities by lesson
    const activitiesByLesson = new Map();
    for (const activity of activities) {
      const lessonId = activity.lessonId;
      if (!activitiesByLesson.has(lessonId)) {
        activitiesByLesson.set(lessonId, []);
      }
      activitiesByLesson.get(lessonId).push(activity.id);
    }

    // Get all activity IDs
    const allActivityIds = activities.map((a) => a.id);

    // Batch fetch completion statuses for all activities
    const completionMap = await getCompletionCountsByActivity(allActivityIds, userId);

    // Calculate progress for each lesson
    const progressByLesson = new Map();
    for (const lessonId of lessonIds) {
      const activityIds = activitiesByLesson.get(lessonId) || [];
      const totalActivities = activityIds.length;

      if (totalActivities === 0) {
        progressByLesson.set(lessonId, { completed: 0, total: 0, percentage: 0 });
        continue;
      }

      const completedCount = activityIds.filter((actId) => completionMap.get(actId) === true).length;

      progressByLesson.set(lessonId, {
        completed: completedCount,
        total: totalActivities,
        percentage: Math.round((completedCount / totalActivities) * 100),
      });
    }

    return progressByLesson;
  } catch (error) {
    console.error('Error calculating multi-lesson progress:', error);
    return new Map();
  }
}

/**
 * Calculate progress for a lesson based on correct submissions
 * Counts all activities (no published filter at activity level)
 */
export async function calculateLessonProgress(lessonId, userId) {
  if (!lessonId || !userId) {
    return { completed: 0, total: 0, percentage: 0 };
  }

  const progressMap = await calculateMultiLessonProgress([lessonId], userId);
  return progressMap.get(lessonId) || { completed: 0, total: 0, percentage: 0 };
}

/**
 * Get completion status for each activity (optimized batch version)
 * Returns map of activityId => true (completed) or false (not completed)
 * Uses a more efficient query with window functions to find latest submissions
 */
async function getCompletionCountsByActivity(activityIds, userId) {
  if (!activityIds || activityIds.length === 0 || !userId) {
    return new Map();
  }

  try {
    // Use raw SQL with window function to efficiently get latest submission per activity
    // This is much faster than fetching all submissions and filtering in JS
    const latestSubmissions = await prisma.$queryRaw`
      SELECT DISTINCT ON (activity_id) 
        activity_id as "activityId",
        is_correct as "isCorrect"
      FROM "Submission"
      WHERE user_id = ${userId}
        AND activity_id = ANY(${activityIds}::int[])
      ORDER BY activity_id, attempt_number DESC
    `;

    const completionMap = new Map();
    for (const sub of latestSubmissions) {
      completionMap.set(sub.activityId, sub.isCorrect === true);
    }

    return completionMap;
  } catch (error) {
    console.error('Error getting completion counts by activity:', error);
    return new Map();
  }
}

/**
 * Get completion status for each activity
 * Returns map of activityId => 'correct' | 'incorrect' | 'not_attempted'
 */
export async function getActivityCompletionStatuses(activityIds, userId) {
  if (!activityIds || activityIds.length === 0 || !userId) {
    return new Map();
  }

  try {
    // Use raw SQL with window function for better performance
    const latestSubmissions = await prisma.$queryRaw`
      SELECT DISTINCT ON (activity_id) 
        activity_id as "activityId",
        is_correct as "isCorrect"
      FROM "Submission"
      WHERE user_id = ${userId}
        AND activity_id = ANY(${activityIds}::int[])
      ORDER BY activity_id, attempt_number DESC
    `;

    const submissionMap = new Map();
    for (const sub of latestSubmissions) {
      submissionMap.set(sub.activityId, sub);
    }

    // Build status map
    const statusMap = new Map();
    for (const activityId of activityIds) {
      const latestSubmission = submissionMap.get(activityId);
      if (!latestSubmission) {
        statusMap.set(activityId, 'not_attempted');
      } else if (latestSubmission.isCorrect === true) {
        statusMap.set(activityId, 'correct');
      } else {
        statusMap.set(activityId, 'incorrect');
      }
    }

    return statusMap;
  } catch (error) {
    console.error('Error getting activity completion statuses:', error);
    return new Map();
  }
}
