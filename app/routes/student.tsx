import { useMemo } from 'react';
import { useNavigate } from 'react-router';
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

  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-50 via-rose-50 to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <Nav />
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-4">My Courses</h2>
        {courseList.length === 0 ? (
          <div className="text-gray-500">No courses assigned yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courseList.map((course) => (
              <button
                key={course.id}
                onClick={() => navigate(`/student/courses/${course.id}`)}
                className="text-left p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/60 hover:shadow-md transition group"
              >
                <div className="font-semibold group-hover:underline">{course.title}</div>
                {course.description && (
                  <div className="text-sm text-gray-500 mb-3">{course.description}</div>
                )}
                {course.progress && course.progress.total > 0 && (
                  <div className="mt-3">
                    <ProgressBarFromData progress={course.progress} size="sm" />
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
