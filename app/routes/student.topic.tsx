import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, GraduationCap } from 'lucide-react';
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import type { Course, Lesson, ModuleDetail } from '../lib/types';
import type { Route } from './+types/student.topic';
import api from '~/lib/api';
import { requireClientUser } from '~/lib/client-auth';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  await requireClientUser('STUDENT');
  const moduleId = Number(params.moduleId);
  if (!Number.isFinite(moduleId)) {
    throw new Response('Invalid module id', { status: 400 });
  }

  const [module, lessons] = await Promise.all([
    api.moduleById(moduleId) as Promise<ModuleDetail>,
    api.lessonsForModule(moduleId) as Promise<Lesson[]>,
  ]);

  let course: Course | null = null;
  if (module.courseOfferingId) {
    course = (await api.courseById(module.courseOfferingId)) as Course;
  }

  return { course, module, lessons };
}

export default function StudentModuleLessons({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { course, module, lessons } = loaderData;
  const lessonList = useMemo(() => lessons ?? [], [lessons]);

  return (
    <main className="app-shell">
      <AppBackdrop pattern="grid" />
      <Nav />

      <AppContainer className="space-y-8 pb-12 pt-8">
        <Breadcrumb className="px-1 text-white/54">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/student" className="hover:text-white">
                  My Courses
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-white/24">/</BreadcrumbSeparator>
            <BreadcrumbItem>
              {course ? (
                <BreadcrumbLink asChild>
                  <Link
                    to={`/student/courses/${module.courseOfferingId}`}
                    className="hover:text-white"
                  >
                    {course.title}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-white">Course</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-white/24">/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-white">{module.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <DashboardHero
          eyebrow={<SectionEyebrow tone="cool">Module flow</SectionEyebrow>}
          title={module.title}
          description="Lessons are now framed as a clear sequence so students can read the structure of the module before entering the activity flow."
          aside={
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <StatPill label="Lessons" value={lessonList.length} />
              <StatPill label="Completion" value={`${module.progress?.percentage ?? 0}%`} />
            </div>
          }
        />

        {lessonList.length === 0 ? (
          <DashboardCard className="mx-auto max-w-2xl p-10 text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-white">
              No lessons available
            </h2>
            <p className="mt-3 text-white/62">Lessons for this module have not been added yet.</p>
          </DashboardCard>
        ) : (
          <DashboardGrid>
            {lessonList.map((lesson, index) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => navigate(`/student/lesson/${lesson.id}`)}
                className="text-left"
                data-tour={index === 0 ? 'student-lesson-card-first' : undefined}
                data-tour-route={index === 0 ? `/student/lesson/${lesson.id}` : undefined}
              >
                <DashboardCard interactive className="glow h-full">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/12 bg-white/8">
                      <GraduationCap className="h-5 w-5 text-amber-200" />
                    </div>
                    <div className="tag">{`Lesson ${index + 1}`}</div>
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold tracking-[-0.05em] text-white">
                    {lesson.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-white/62">
                    Enter the lesson to answer activities, get guidance, and receive feedback in the
                    redesigned player.
                  </p>
                  <div className="mt-8">
                    <ProgressBarFromData progress={lesson.progress} size="md" showLabel />
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-amber-100">
                    Open lesson
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
