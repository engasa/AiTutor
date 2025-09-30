import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import Nav from '../components/Nav';
import api from '../lib/api';
import type { Course, CourseStatus } from '../lib/types';
import type { Route } from './+types/instructor';
import { fetchJson, requireUserFromRequest } from '~/lib/server-api';

const statusLabels: Record<CourseStatus, string> = {
  ACTIVE: 'Active',
  DRAFT: 'Draft',
  ARCHIVED: 'Completed',
};

const sectionOrder: CourseStatus[] = ['ACTIVE', 'DRAFT', 'ARCHIVED'];

const statusOptions: Array<{ value: CourseStatus; label: string }> = [
  { value: 'DRAFT', label: statusLabels.DRAFT },
  { value: 'ACTIVE', label: statusLabels.ACTIVE },
  { value: 'ARCHIVED', label: statusLabels.ARCHIVED },
];

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserFromRequest(request, 'INSTRUCTOR');
  const courses = await fetchJson<Course[]>(request, '/api/courses');
  return { courses };
}

export default function InstructorHome({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>(loaderData.courses ?? []);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceCourseId, setSourceCourseId] = useState<number | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  const courseSections = useMemo(
    () =>
      sectionOrder
        .map((status) => ({
          status,
          label: `${statusLabels[status]} courses`,
          courses: courses.filter((course) => course.status === status),
        }))
        .filter((section) => section.courses.length > 0),
    [courses]
  );

  const loadCourses = async () => {
    setLoading(true);
    try {
      const data: Course[] = await api.listCourses();
      setCourses(data);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCourseStatus = async (courseId: number, status: CourseStatus) => {
    setUpdatingStatusId(courseId);
    try {
      await api.updateCourse(courseId, { status });
      setCourses((prev) =>
        prev.map((course) => (course.id === courseId ? { ...course, status } : course))
      );
    } catch (error) {
      console.error('Failed to update course status', error);
      await loadCourses();
    } finally {
      setUpdatingStatusId((current) => (current === courseId ? null : current));
    }
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await api.createCourse({
        title: title.trim(),
        description: description.trim() ? description.trim() : undefined,
        sourceCourseId: sourceCourseId == null ? undefined : sourceCourseId,
        status: sourceCourseId == null ? 'DRAFT' : 'ACTIVE',
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setSourceCourseId(null);
      loadCourses();
    } catch (error) {
      console.error('Failed to create course', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <Nav />
      <div className="container mx-auto px-4 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Teaching</h2>
            <button
              onClick={() => setShowCreate((prev) => !prev)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold shadow hover:shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
            >
              {showCreate ? 'Close' : 'New Course'}
            </button>
          </div>

          {showCreate && (
            <form
              onSubmit={onCreate}
              className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold mb-1">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Algorithms - Winter Cohort"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Optional description for learners"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Clone from existing course</label>
                <select
                  value={sourceCourseId ?? ''}
                  onChange={(e) => {
                    const nextValue = e.target.value ? Number(e.target.value) : null;
                    setSourceCourseId(nextValue);
                  }}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Start from empty course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title} • {statusLabels[course.status]}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Selecting a source copies its modules, lessons, and activities into the new course.
                </p>
              </div>
              <button
                type="submit"
                disabled={creating || !title.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow"
              >
                {creating ? 'Creating…' : 'Create course'}
              </button>
            </form>
          )}

          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : courses.length === 0 ? (
            <div className="text-gray-500">No courses yet. Create one to get started.</div>
          ) : (
            <div className="space-y-6">
              {courseSections.map((section) => (
                <div key={section.status} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" aria-hidden />
                    <span>{section.label}</span>
                    <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" aria-hidden />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {section.courses.map((c) => (
                      <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/instructor/courses/${c.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            navigate(`/instructor/courses/${c.id}`);
                          }
                        }}
                        className="text-left p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/60 hover:shadow-lg transition group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 cursor-pointer flex flex-col h-full"
                      >
                        <div className="font-semibold text-lg leading-snug group-hover:underline">
                          {c.title}
                        </div>
                        {c.description && (
                          <div className="text-sm text-gray-500 mt-2">{c.description}</div>
                        )}
                        <div className="flex-grow"></div>
                        <div className="flex justify-end mt-4">
                          <div
                            className="relative inline-flex"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <select
                              value={c.status}
                              disabled={updatingStatusId === c.id}
                              onChange={(event) => {
                                event.stopPropagation();
                                updateCourseStatus(c.id, event.target.value as CourseStatus);
                              }}
                              className="appearance-none w-[120px] px-3 pr-7 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition"
                            >
                              {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 dark:text-gray-500">
                              ▾
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
