import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Layers3 } from 'lucide-react';
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
import type { Course, Module } from '../lib/types';
import type { Route } from './+types/student.course';
import api from '~/lib/api';
import { requireClientUser } from '~/lib/client-auth';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  await requireClientUser('STUDENT');
  const courseId = Number(params.courseId);
  if (!Number.isFinite(courseId)) {
    throw new Response('Invalid course id', { status: 400 });
  }

  const [course, modules] = await Promise.all([
    api.courseById(courseId) as Promise<Course>,
    api.modulesForCourse(courseId) as Promise<Module[]>,
  ]);

  return { course, modules };
}

export default function StudentCourseModules({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { course, modules } = loaderData;
  const moduleList = useMemo(() => modules ?? [], [modules]);

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
              <BreadcrumbPage className="text-white">{course.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <DashboardHero
          eyebrow={<SectionEyebrow tone="warm">Course map</SectionEyebrow>}
          title={course.title}
          description={
            course.description ||
            'Move through modules in sequence, with each step carrying progress and a cleaner sense of what comes next.'
          }
          aside={
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <StatPill label="Modules" value={moduleList.length} />
              <StatPill label="Completion" value={`${course.progress?.percentage ?? 0}%`} />
            </div>
          }
        />

        {moduleList.length === 0 ? (
          <DashboardCard className="mx-auto max-w-2xl p-10 text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-white">
              No modules available
            </h2>
            <p className="mt-3 text-white/62">
              This course does not have modules yet. When content is ready, it will appear here.
            </p>
          </DashboardCard>
        ) : (
          <DashboardGrid>
            {moduleList.map((module, index) => (
              <button
                key={module.id}
                type="button"
                onClick={() => navigate(`/student/module/${module.id}`)}
                className="text-left"
                data-tour={index === 0 ? 'student-module-card-first' : undefined}
                data-tour-route={index === 0 ? `/student/module/${module.id}` : undefined}
              >
                <DashboardCard interactive className="glow h-full">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/12 bg-white/8">
                      <Layers3 className="h-5 w-5 text-cyan-200" />
                    </div>
                    <div className="tag">{`Module ${index + 1}`}</div>
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold tracking-[-0.05em] text-white">
                    {module.title}
                  </h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/62">
                    {module.description ||
                      'Open the module to continue through its lessons and activities.'}
                  </p>
                  <div className="mt-8">
                    <ProgressBarFromData progress={module.progress} size="md" showLabel />
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-amber-100">
                    Open module
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
