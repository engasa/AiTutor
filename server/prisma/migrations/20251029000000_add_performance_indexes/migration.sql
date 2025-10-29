-- Add indexes to improve query performance

-- Index for finding activities by lesson (used in progress calculation)
CREATE INDEX IF NOT EXISTS "Activity_lessonId_idx" ON "Activity"("lessonId");

-- Composite index for finding submissions by user and activity
-- This significantly speeds up the progress calculation queries
CREATE INDEX IF NOT EXISTS "Submission_userId_activityId_idx" ON "Submission"("userId", "activityId");

-- Index for finding latest submission per activity (used with attemptNumber)
CREATE INDEX IF NOT EXISTS "Submission_activityId_attemptNumber_idx" ON "Submission"("activityId", "attemptNumber" DESC);

-- Index for finding modules by course offering (used frequently)
CREATE INDEX IF NOT EXISTS "Module_courseOfferingId_idx" ON "Module"("courseOfferingId");

-- Index for finding lessons by module (used frequently)
CREATE INDEX IF NOT EXISTS "Lesson_moduleId_idx" ON "Lesson"("moduleId");

-- Composite index for filtering published modules and lessons
CREATE INDEX IF NOT EXISTS "Module_courseOfferingId_isPublished_idx" ON "Module"("courseOfferingId", "isPublished");
CREATE INDEX IF NOT EXISTS "Lesson_moduleId_isPublished_idx" ON "Lesson"("moduleId", "isPublished");

-- Index for course enrollments (used in student course listing)
CREATE INDEX IF NOT EXISTS "CourseEnrollment_userId_idx" ON "CourseEnrollment"("userId");

-- Index for course instructors (used in instructor course listing)
CREATE INDEX IF NOT EXISTS "CourseInstructor_userId_idx" ON "CourseInstructor"("userId");

-- Index for topic lookups by course
CREATE INDEX IF NOT EXISTS "Topic_courseOfferingId_idx" ON "Topic"("courseOfferingId");
