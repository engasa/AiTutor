import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import Nav from '../components/Nav';
import { ProgressBarFromData } from '../components/ProgressBar';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import type { Course, Module } from '../lib/types';
import type { Route } from './+types/student.course';
import { fetchJson, requireUserFromRequest } from '~/lib/server-api';

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserFromRequest(request, 'STUDENT');
  const courseId = Number(params.courseId);
  if (!Number.isFinite(courseId)) {
    throw new Response('Invalid course id', { status: 400 });
  }

  const [course, modules] = await Promise.all([
    fetchJson<Course>(request, `/api/courses/${courseId}`),
    fetchJson<Module[]>(request, `/api/courses/${courseId}/modules`),
  ]);

  return { course, modules };
}

export default function StudentCourseModules({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { course, modules } = loaderData;
  const moduleList = useMemo(() => modules ?? [], [modules]);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-50 via-rose-50 to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <Nav />
      <div className="container mx-auto px-4 py-8">
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/student">My Courses</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{course?.title || 'Course'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h2 className="text-2xl font-bold mb-4">Modules</h2>
        {moduleList.length === 0 ? (
          <div className="text-gray-500">No modules available yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {moduleList.map((module) => (
              <button
                key={module.id}
                onClick={() => navigate(`/student/module/${module.id}`)}
                className="text-left p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/60 hover:shadow-md transition group"
              >
                <div className="font-semibold group-hover:underline">{module.title}</div>
                {module.description && <div className="text-sm text-gray-500 mb-3">{module.description}</div>}
                {module.progress && module.progress.total > 0 && (
                  <div className="mt-3">
                    <ProgressBarFromData progress={module.progress} size="sm" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
