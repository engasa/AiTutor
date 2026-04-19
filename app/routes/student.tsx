import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import {
  AppBackdrop,
  AppContainer,
  DashboardCard,
  DashboardGrid,
  DashboardHero,
  SectionEyebrow,
  StatPill,
} from '~/components/AppShell';
import Nav from '../components/Nav';
import { ProgressBarFromData } from '../components/ProgressBar';
import type { Course } from '../lib/types';
import type { Route } from './+types/student';
import api from '~/lib/api';
import { requireClientUser } from '~/lib/client-auth';

export async function clientLoader(_: Route.ClientLoaderArgs) {
  await requireClientUser('STUDENT');
  const courses = (await api.listCourses()) as Course[];
  return { courses };
}

export default function StudentHome({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const courseList = useMemo(() => loaderData.courses ?? [], [loaderData.courses]);
  const totalActivities = courseList.reduce(
    (sum, course) => sum + (course.progress?.total ?? 0),
    0,
  );
  const completedActivities = courseList.reduce(
    (sum, course) => sum + (course.progress?.completed ?? 0),
    0,
  );

  return (
    <main className="app-shell">
      <AppBackdrop pattern="grid" />
      <Nav />

      <AppContainer className="space-y-8 pb-12 pt-8">
        <DashboardHero
          eyebrow={<SectionEyebrow tone="cool">Student workspace</SectionEyebrow>}
          title={
            <>
              Learn through a calmer flow,
              <span className="text-gradient"> not a cluttered portal.</span>
            </>
          }
          description="Courses now lead with progress, pace, and the next meaningful move. Open any course to continue exactly where you left off."
          aside={
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <StatPill label="Courses" value={courseList.length} />
              <StatPill label="Completed" value={completedActivities} />
              <StatPill label="Activities" value={totalActivities || 'No work yet'} />
            </div>
          }
        />

        {courseList.length === 0 ? (
          <DashboardCard className="mx-auto max-w-2xl p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-white/10">
              <BookOpen className="h-7 w-7 text-amber-200" />
            </div>
            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-white">
              No courses yet
            </h2>
            <p className="mt-3 text-white/62">
              You have not been enrolled in any courses. Once you are added, they will appear here
              with progress and direct entry points.
            </p>
          </DashboardCard>
        ) : (
          <DashboardGrid>
            {courseList.map((course, index) => (
              <button
                key={course.id}
                type="button"
                onClick={() => navigate(`/student/courses/${course.id}`)}
                className="text-left"
                data-tour={index === 0 ? 'student-course-card-first' : undefined}
                data-tour-route={index === 0 ? `/student/courses/${course.id}` : undefined}
              >
                <DashboardCard interactive className="glow h-full">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/12 bg-white/8">
                      <Sparkles className="h-5 w-5 text-cyan-200" />
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/15 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/42">
                      Course
                    </div>
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold tracking-[-0.05em] text-white">
                    {course.title}
                  </h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/62">
                    {course.description ||
                      'Open the course to continue through modules, lessons, and guided activities.'}
                  </p>
                  <div className="mt-8">
                    <ProgressBarFromData progress={course.progress} size="md" showLabel />
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-amber-100">
                    Continue course
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </DashboardCard>
              </button>
            ))}
          </DashboardGrid>
        )}
      </AppContainer>
    </main>
  );
}
