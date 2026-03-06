import { prisma } from '../config/database.js';

export function calculateDifficulty({
  studentCount,
  helpRequestCount,
  submissionCount,
  incorrectSubmissionCount,
  averageRating,
}) {
  const normalizedStudentCount = Math.max(studentCount || 0, 1);
  const helpPerStudent = helpRequestCount / normalizedStudentCount;
  const incorrectRate = submissionCount > 0 ? incorrectSubmissionCount / submissionCount : 0;
  const ratingPenalty = typeof averageRating === 'number' ? (5 - averageRating) / 4 : 0;

  const difficultyScore = Math.max(
    0,
    Math.min(100, Math.round(helpPerStudent * 15 + incorrectRate * 45 + ratingPenalty * 25)),
  );

  const difficultyLabel =
    difficultyScore >= 65 ? 'HIGH' : difficultyScore >= 35 ? 'MEDIUM' : 'LOW';

  return { difficultyScore, difficultyLabel };
}

async function recalculateActivityAnalytics(tx, activityId) {
  const [studentMetrics, feedbackRecords] = await Promise.all([
    tx.activityStudentMetric.findMany({
      where: { activityId },
      select: {
        helpRequestCount: true,
        submissionCount: true,
        incorrectSubmissionCount: true,
        correctSubmissionCount: true,
      },
    }),
    tx.activityFeedback.findMany({
      where: { activityId },
      select: { rating: true },
    }),
  ]);

  const aggregates = studentMetrics.reduce(
    (acc, metric) => {
      acc.helpRequestCount += metric.helpRequestCount;
      acc.submissionCount += metric.submissionCount;
      acc.incorrectSubmissionCount += metric.incorrectSubmissionCount;
      acc.correctSubmissionCount += metric.correctSubmissionCount;
      return acc;
    },
    {
      helpRequestCount: 0,
      submissionCount: 0,
      incorrectSubmissionCount: 0,
      correctSubmissionCount: 0,
    },
  );

  const feedbackCount = feedbackRecords.length;
  const averageRating =
    feedbackCount > 0
      ? feedbackRecords.reduce((sum, feedback) => sum + feedback.rating, 0) / feedbackCount
      : null;

  const { difficultyScore, difficultyLabel } = calculateDifficulty({
    studentCount: studentMetrics.length,
    helpRequestCount: aggregates.helpRequestCount,
    submissionCount: aggregates.submissionCount,
    incorrectSubmissionCount: aggregates.incorrectSubmissionCount,
    averageRating,
  });

  return tx.activityAnalytics.upsert({
    where: { activityId },
    update: {
      ...aggregates,
      studentCount: studentMetrics.length,
      feedbackCount,
      averageRating,
      difficultyScore,
      difficultyLabel,
    },
    create: {
      activityId,
      ...aggregates,
      studentCount: studentMetrics.length,
      feedbackCount,
      averageRating,
      difficultyScore,
      difficultyLabel,
    },
  });
}

export async function recordAiHelpRequest({ userId, activityId }) {
  return prisma.$transaction(async (tx) => {
    await tx.activityStudentMetric.upsert({
      where: {
        userId_activityId: {
          userId,
          activityId,
        },
      },
      update: {
        helpRequestCount: {
          increment: 1,
        },
      },
      create: {
        userId,
        activityId,
        helpRequestCount: 1,
      },
    });

    return recalculateActivityAnalytics(tx, activityId);
  });
}

export async function recordSubmissionMetrics({ userId, activityId, isCorrect }) {
  return prisma.$transaction(async (tx) => {
    await tx.activityStudentMetric.upsert({
      where: {
        userId_activityId: {
          userId,
          activityId,
        },
      },
      update: {
        submissionCount: {
          increment: 1,
        },
        incorrectSubmissionCount: {
          increment: isCorrect ? 0 : 1,
        },
        correctSubmissionCount: {
          increment: isCorrect ? 1 : 0,
        },
      },
      create: {
        userId,
        activityId,
        submissionCount: 1,
        incorrectSubmissionCount: isCorrect ? 0 : 1,
        correctSubmissionCount: isCorrect ? 1 : 0,
      },
    });

    return recalculateActivityAnalytics(tx, activityId);
  });
}

export async function recordActivityFeedback({ userId, activityId, submissionId, rating, note }) {
  return prisma.$transaction(async (tx) => {
    const feedback = await tx.activityFeedback.create({
      data: {
        userId,
        activityId,
        submissionId,
        rating,
        note: note || null,
      },
    });

    await recalculateActivityAnalytics(tx, activityId);
    return feedback;
  });
}

export async function hasActivityFeedback({ userId, activityId }) {
  const existing = await prisma.activityFeedback.findUnique({
    where: {
      userId_activityId: {
        userId,
        activityId,
      },
    },
    select: { id: true },
  });

  return Boolean(existing);
}
