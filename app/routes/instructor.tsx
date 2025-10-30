import type { FormEvent } from 'react';
import { useOptimistic, useState } from 'react';
import { useNavigate } from 'react-router';
import Nav from '../components/Nav';
import { PublishStatusButton } from '../components/PublishStatusButton';
import api from '../lib/api';
import type { Course, EduAiCourse } from '../lib/types';
import type { Route } from './+types/instructor';
import { fetchJson, requireUserFromRequest } from '~/lib/server-api';

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
  const [showEduAiImport, setShowEduAiImport] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceCourseId, setSourceCourseId] = useState<number | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [eduAiCourses, setEduAiCourses] = useState<EduAiCourse[]>([]);
  const [loadingEduAiCourses, setLoadingEduAiCourses] = useState(false);
  const [importingExternalId, setImportingExternalId] = useState<string | null>(null);
  const [eduAiError, setEduAiError] = useState<string | null>(null);

  const [oCourses, addCourseOpt] = useOptimistic(
    courses,
    (state, patch: (items: Course[]) => Course[]) => patch(state),
  );

  const parseErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed && typeof parsed === 'object' && typeof parsed.error === 'string') {
          return parsed.error;
        }
      } catch {
        // Ignore JSON parse failures and fall back to the original message
      }
      return error.message;
    }
    return 'Something went wrong. Please try again.';
  };

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

  const fetchEduAiCourses = async () => {
    setLoadingEduAiCourses(true);
    setEduAiError(null);
    try {
      const data = (await api.listEduAiCourses()) as EduAiCourse[];
      setEduAiCourses(data);
    } catch (error) {
      console.error('Failed to load EduAI courses:', error);
      setEduAiError(parseErrorMessage(error));
    } finally {
      setLoadingEduAiCourses(false);
    }
  };

  const ensureEduAiCourses = () => {
    if (eduAiCourses.length > 0 || loadingEduAiCourses) return;
    fetchEduAiCourses();
  };

  const importEduAiCourse = async (externalCourseId: string) => {
    if (!externalCourseId) return;
    setImportingExternalId(externalCourseId);
    setEduAiError(null);
    try {
      await api.importEduAiCourse({ externalCourseId });
      setEduAiCourses((prev) => prev.filter((course) => course.id !== externalCourseId));
      await loadCourses();
    } catch (error) {
      console.error('Failed to import EduAI course:', error);
      setEduAiError(parseErrorMessage(error));
    } finally {
      setImportingExternalId((current) => (current === externalCourseId ? null : current));
    }
  };

  const togglePublish = async (courseId: number, currentlyPublished: boolean) => {
    // Optimistic update via useOptimistic
    addCourseOpt((items) =>
      items.map((course) =>
        course.id === courseId ? { ...course, isPublished: !currentlyPublished } : course,
      ),
    );
    setPublishingId(courseId);

    try {
      const updated = currentlyPublished
        ? await api.unpublishCourse(courseId)
        : await api.publishCourse(courseId);
      // Confirm with server response
      setCourses((prev) =>
        prev.map((course) => (course.id === courseId ? updated : course))
      );
    } catch (error) {
      console.error('Failed to toggle publish status', error);
      // Rollback on error to clear optimistic change
      setCourses((prev) =>
        prev.map((course) =>
          course.id === courseId ? { ...course, isPublished: currentlyPublished } : course,
        ),
      );
    } finally {
      setPublishingId((current) => (current === courseId ? null : current));
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Teaching</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowEduAiImport((prev) => {
                    const next = !prev;
                    if (next) {
                      setShowCreate(false);
                      ensureEduAiCourses();
                    } else {
                      setEduAiError(null);
                    }
                    return next;
                  });
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 text-white font-semibold shadow hover:shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                {showEduAiImport ? 'Close Import' : 'Import from EduAI'}
              </button>
              <button
                onClick={() => {
                  setShowCreate((prev) => {
                    const next = !prev;
                    if (next) {
                      setShowEduAiImport(false);
                      setEduAiError(null);
                    }
                    return next;
                  });
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold shadow hover:shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
              >
                {showCreate ? 'Close' : 'New Course'}
              </button>
            </div>
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
                      {course.title}
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

          {showEduAiImport && (
            <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Import from EduAI</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select a course to add its teaching card. Modules, lessons, and activities will be
                    created manually after the import.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchEduAiCourses}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  disabled={loadingEduAiCourses}
                >
                  {loadingEduAiCourses ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
              {eduAiError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/80 dark:bg-red-950/50 dark:text-red-200">
                  {eduAiError}
                </div>
              )}
              {loadingEduAiCourses ? (
                <div className="text-gray-500">Loading EduAI courses…</div>
              ) : eduAiCourses.length === 0 ? (
                <div className="text-gray-500">
                  No courses available from EduAI yet. Try refreshing to sync again.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {eduAiCourses.map((course) => {
                    const termYear = [course.term, course.year].filter(Boolean).join(' ');
                    return (
                      <div
                        key={course.id}
                        className="flex h-full flex-col rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/60 p-4 shadow-sm"
                      >
                        <div className="space-y-1">
                          {course.code && (
                            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                              {course.code}
                            </div>
                          )}
                          {course.name && (
                            <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                              {course.name}
                            </div>
                          )}
                          {termYear && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">{termYear}</div>
                          )}
                        </div>
                        {course.description && (
                          <p className="mt-3 flex-1 text-sm text-gray-600 dark:text-gray-300">
                            {course.description}
                          </p>
                        )}
                        {course.aiInstructions && (
                          <p className="mt-3 text-xs italic text-gray-500 dark:text-gray-400">
                            AI instructions: {course.aiInstructions}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => importEduAiCourse(course.id)}
                          disabled={importingExternalId === course.id}
                          className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {importingExternalId === course.id ? 'Importing…' : 'Import course'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : oCourses.length === 0 ? (
            <div className="text-gray-500">No courses yet. Create one to get started.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {oCourses.map((c) => (
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-lg leading-snug group-hover:underline">
                      {c.title}
                    </div>
                    {c.externalSource === 'EDUAI' && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                        EduAI
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <div className="text-sm text-gray-500 mt-2">{c.description}</div>
                  )}
                  <div className="flex-grow"></div>
                  <div className="mt-4 flex justify-end">
                    <div
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <PublishStatusButton
                        isPublished={c.isPublished}
                        pending={publishingId === c.id}
                        onClick={() => {
                          if (publishingId === c.id) return;
                          togglePublish(c.id, c.isPublished);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
