/**
 * @file Sync course rosters from EduAI into local AiTutor enrollments.
 *
 * Responsibility: For an EduAI-imported `CourseOffering`, fetch the upstream
 *   roster, materialize User+Account stubs for students who haven't logged
 *   in yet, and upsert local `CourseEnrollment` rows.
 * Callers: Course import/sync routes (`routes/courses.js`).
 * Gotchas:
 *   - Pre-creates an `Account` row with `providerId='eduai'` keyed by the
 *     EduAI student id BEFORE the student ever signs in. When they later
 *     OAuth-link via Better Auth, `accountLinking.trustedProviders: ['eduai']`
 *     in `auth.js` causes Better Auth to pick up this pre-existing account
 *     row instead of creating a duplicate user — that's why the trusted
 *     providers list exists.
 *   - Existing accounts and users are batch-fetched up front
 *     (`findMany({ in: [...] })`) to avoid an N+1 lookup on large rosters.
 *   - `update: {}` on the enrollment upsert is intentional: re-syncing the
 *     same roster should be a no-op, not bump `enrolledAt` to "now".
 *   - Only `isActive` enrollments from EduAI are imported; deactivated rows
 *     are ignored (we don't currently delete local enrollments to mirror).
 *   - Per-student errors are accumulated in the `errors` array and returned;
 *     a missing student email is the most common cause.
 * Related: `eduaiClient.js`, `eduaiAuth.js`, `../auth.js` (trustedProviders),
 *   `routes/courses.js`.
 */

import { prisma } from '../config/database.js';
import { listEduAiCourseEnrollments } from './eduaiClient.js';
import { EDUAI_PROVIDER_ID } from './eduaiAuth.js';
import { normalizeEmail } from '../config/bootstrapAdmins.js';

/**
 * Sync enrollments from EduAI for an imported course into local DB.
 * Finds or creates AiTutor users + accounts, then upserts CourseEnrollment records.
 * @param {number} courseOfferingId
 * @param {{ accessToken?: string, course?: object }} options
 * @returns {{ synced: number, created: number, errors: Array<{ studentId: string, reason: string }> }}
 */
export async function syncCourseEnrollments(courseOfferingId, options = {}) {
  if (!Number.isFinite(courseOfferingId)) {
    return { synced: 0, created: 0, errors: [] };
  }

  const course =
    options.course ?? (await prisma.courseOffering.findUnique({ where: { id: courseOfferingId } }));
  if (!course || !course.externalId || course.externalSource !== 'EDUAI') {
    return { synced: 0, created: 0, errors: [] };
  }

  const externalEnrollments = await listEduAiCourseEnrollments(
    course.externalId,
    options.accessToken,
  );

  const activeEnrollments = (externalEnrollments ?? []).filter((e) => e.isActive);
  if (activeEnrollments.length === 0) {
    return { synced: 0, created: 0, errors: [] };
  }

  // Batch-fetch existing accounts and users to avoid N+1 queries
  const studentIds = activeEnrollments.map((e) => e.studentId);
  const studentEmails = activeEnrollments
    .map((e) => normalizeEmail(e.studentEmail))
    .filter(Boolean);

  const [existingAccounts, existingUsers] = await Promise.all([
    prisma.account.findMany({
      where: { providerId: EDUAI_PROVIDER_ID, accountId: { in: studentIds } },
    }),
    prisma.user.findMany({
      where: { email: { in: studentEmails } },
    }),
  ]);

  const accountByExternalId = new Map(existingAccounts.map((a) => [a.accountId, a]));
  const userByEmail = new Map(existingUsers.map((u) => [u.email, u]));

  let synced = 0;
  let created = 0;
  const errors = [];

  for (const enrollment of activeEnrollments) {
    try {
      const account = accountByExternalId.get(enrollment.studentId);
      let userId;

      if (account) {
        // Already pre-linked: reuse existing user.
        userId = account.userId;
      } else {
        const email = normalizeEmail(enrollment.studentEmail);
        const name =
          typeof enrollment.studentName === 'string' && enrollment.studentName.trim()
            ? enrollment.studentName.trim()
            : 'EduAI Student';

        if (!email) {
          errors.push({ studentId: enrollment.studentId, reason: 'Missing student email' });
          continue;
        }

        // Email match takes precedence so we don't fork a user who
        // signed up locally before being added to the EduAI roster.
        const existingUser = userByEmail.get(email);
        if (existingUser) {
          userId = existingUser.id;
        } else {
          // Create user + account so Better Auth links them on first OAuth login
          const newUser = await prisma.user.create({
            data: { name, email, role: 'STUDENT', emailVerified: false },
          });
          userId = newUser.id;
          userByEmail.set(email, newUser);
        }

        await prisma.account.create({
          data: { providerId: EDUAI_PROVIDER_ID, accountId: enrollment.studentId, userId },
        });
        accountByExternalId.set(enrollment.studentId, {
          accountId: enrollment.studentId,
          userId,
        });
        created++;
      }

      await prisma.courseEnrollment.upsert({
        where: { courseOfferingId_userId: { courseOfferingId, userId } },
        update: {},
        create: {
          courseOfferingId,
          userId,
          enrolledAt: enrollment.enrolledAt ? new Date(enrollment.enrolledAt) : new Date(),
        },
      });

      synced++;
    } catch (e) {
      errors.push({ studentId: enrollment.studentId, reason: e.message || String(e) });
    }
  }

  return { synced, created, errors };
}
