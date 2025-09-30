import type { FormEvent } from 'react';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import Nav from '../components/Nav';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import { PublishStatusButton } from '../components/PublishStatusButton';
import api from '../lib/api';
import type { Course, Lesson, Module, ModuleDetail } from '../lib/types';
import type { Route } from './+types/instructor.topic';
import { fetchJson, requireUserFromRequest } from '~/lib/server-api';

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserFromRequest(request, 'INSTRUCTOR');
  const moduleId = Number(params.moduleId);
  if (!Number.isFinite(moduleId)) {
    throw new Response('Invalid module id', { status: 400 });
  }

  const [module, lessons] = await Promise.all([
    fetchJson<ModuleDetail>(request, `/api/modules/${moduleId}`),
    fetchJson<Lesson[]>(request, `/api/modules/${moduleId}/lessons`),
  ]);

  const course = await fetchJson<Course>(request, `/api/courses/${module.courseOfferingId}`);

  return { course, module, lessons };
}

export default function InstructorModuleLessons({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const numericModuleId = moduleId ? Number(moduleId) : null;
  const { course, module, lessons: initialLessons } = loaderData;
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedSourceCourseId, setSelectedSourceCourseId] = useState<number | null>(null);
  const [sourceModules, setSourceModules] = useState<Module[]>([]);
  const [selectedSourceModuleId, setSelectedSourceModuleId] = useState<number | null>(null);
  const [sourceLessons, setSourceLessons] = useState<Lesson[]>([]);
  const [loadingSourceCourses, setLoadingSourceCourses] = useState(false);
  const [loadingSourceModules, setLoadingSourceModules] = useState(false);
  const [loadingSourceLessons, setLoadingSourceLessons] = useState(false);
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);

  useEffect(() => {
    setLessons(initialLessons);
  }, [initialLessons]);

  const refreshLessons = async () => {
    if (!numericModuleId) return;
    try {
      const lessonData = await api.lessonsForModule(numericModuleId);
      setLessons(lessonData);
    } catch (error) {
      console.error('Failed to refresh lessons', error);
    }
  };

  const ensureSourceCoursesLoaded = () => {
    if (availableCourses.length > 0) return;
    setLoadingSourceCourses(true);
    api
      .listCourses()
      .then((data: Course[]) => {
        const nextCourses = module?.courseOfferingId
          ? data.filter((course: Course) => course.id !== module.courseOfferingId)
          : data;
        setAvailableCourses(nextCourses);
      })
      .catch((error) => console.error('Failed to load courses', error))
      .finally(() => setLoadingSourceCourses(false));
  };

  useEffect(() => {
    if (!module?.courseOfferingId) return;
    setAvailableCourses((courses) =>
      courses.filter((course: Course) => course.id !== module.courseOfferingId)
    );
  }, [module?.courseOfferingId]);

  useEffect(() => {
    if (selectedSourceCourseId == null) {
      setSourceModules([]);
      setSelectedSourceModuleId(null);
      setSourceLessons([]);
      setSelectedLessonIds(new Set());
      return;
    }

    setLoadingSourceModules(true);
    api
      .modulesForCourse(selectedSourceCourseId)
      .then((data: Module[]) => {
        setSourceModules(data);
        setSelectedSourceModuleId(null);
        setSourceLessons([]);
        setSelectedLessonIds(new Set());
      })
      .catch((error) => console.error('Failed to load modules for course', error))
      .finally(() => setLoadingSourceModules(false));
  }, [selectedSourceCourseId]);

  useEffect(() => {
    if (selectedSourceModuleId == null) {
      setSourceLessons([]);
      setSelectedLessonIds(new Set());
      return;
    }

    setLoadingSourceLessons(true);
    api
      .lessonsForModule(selectedSourceModuleId)
      .then((data: Lesson[]) => {
        setSourceLessons(data);
        setSelectedLessonIds(new Set());
      })
      .catch((error) => console.error('Failed to load lessons for module', error))
      .finally(() => setLoadingSourceLessons(false));
  }, [selectedSourceModuleId]);

  const onCreateLesson = async (event: FormEvent) => {
    event.preventDefault();
    if (!numericModuleId || !title.trim()) return;
    setCreating(true);
    try {
      await api.createLesson(numericModuleId, { title: title.trim() });
      setTitle('');
      refreshLessons();
    } catch (error) {
      console.error('Failed to create lesson', error);
    } finally {
      setCreating(false);
    }
  };

  const toggleLesson = (lessonId: number) => {
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  const onImportLessons = async () => {
    if (!module || !numericModuleId || selectedSourceModuleId == null || selectedLessonIds.size === 0)
      return;
    setImporting(true);
    try {
      await api.importIntoCourse(module.courseOfferingId, {
        lessonIds: Array.from(selectedLessonIds),
        targetModuleId: numericModuleId,
      });
      setShowImport(false);
      setSelectedSourceCourseId(null);
      setSelectedSourceModuleId(null);
      setSourceLessons([]);
      setSelectedLessonIds(new Set());
      refreshLessons();
    } catch (error) {
      console.error('Import lessons failed', error);
    } finally {
      setImporting(false);
    }
  };

  const togglePublish = async (lessonId: number, currentlyPublished: boolean) => {
    // Optimistic update
    setLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, isPublished: !currentlyPublished } : l))
    );
    setPublishingId(lessonId);

    try {
      const updated = currentlyPublished
        ? await api.unpublishLesson(lessonId)
        : await api.publishLesson(lessonId);
      // Confirm with server response
      setLessons((prev) => prev.map((l) => (l.id === lessonId ? updated : l)));
    } catch (error) {
      console.error('Failed to toggle publish status', error);
      // Rollback on error
      setLessons((prev) =>
        prev.map((l) => (l.id === lessonId ? { ...l, isPublished: currentlyPublished } : l))
      );
    } finally {
      setPublishingId((current) => (current === lessonId ? null : current));
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <Nav />
      <div className="container mx-auto px-4 py-8 space-y-6">
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/instructor">Teaching</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>/</BreadcrumbSeparator>
              <BreadcrumbItem>
                {course && module ? (
                  <BreadcrumbLink asChild>
                    <Link to={`/instructor/courses/${module.courseOfferingId}`}>{course.title}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>Course</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              <BreadcrumbSeparator>/</BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>{module?.title || 'Module'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Lessons</h2>
            </div>
            <button
              onClick={() => {
                if (!showImport) {
                  ensureSourceCoursesLoaded();
                } else {
                  setSelectedSourceCourseId(null);
                  setSelectedSourceModuleId(null);
                  setSourceModules([]);
                  setSourceLessons([]);
                  setSelectedLessonIds(new Set());
                }
                setShowImport((prev) => !prev);
              }}
              className="px-3 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold"
            >
              {showImport ? 'Close' : 'Import Lessons'}
            </button>
          </div>

          {showImport && (
            <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/70 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Choose course</label>
                <select
                  value={selectedSourceCourseId ?? ''}
                  onChange={(e) => {
                    const nextValue = e.target.value ? Number(e.target.value) : null;
                    setSelectedSourceCourseId(nextValue);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
                >
                  <option value="">Select course…</option>
                  {availableCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
                {loadingSourceCourses && (
                  <p className="mt-2 text-xs text-gray-500">Loading courses…</p>
                )}
                {!loadingSourceCourses && availableCourses.length === 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    You don’t have another course to copy from yet.
                  </p>
                )}
              </div>

              {selectedSourceCourseId != null && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Choose module</label>
                  <select
                    value={selectedSourceModuleId ?? ''}
                    onChange={(e) => {
                      const nextValue = e.target.value ? Number(e.target.value) : null;
                      setSelectedSourceModuleId(nextValue);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
                  >
                    <option value="">Select module…</option>
                    {sourceModules.map((sourceModule) => (
                      <option key={sourceModule.id} value={sourceModule.id}>
                        {sourceModule.title}
                      </option>
                    ))}
                  </select>
                  {loadingSourceModules && (
                    <p className="mt-2 text-xs text-gray-500">Loading modules…</p>
                  )}
                  {!loadingSourceModules && sourceModules.length === 0 && (
                    <p className="mt-2 text-xs text-gray-500">Selected course has no modules yet.</p>
                  )}
                </div>
              )}

              {selectedSourceCourseId == null ? (
                <p className="text-sm text-gray-500">Select a course to begin.</p>
              ) : selectedSourceModuleId == null ? (
                <p className="text-sm text-gray-500">Select a module to preview lessons.</p>
              ) : loadingSourceLessons ? (
                <p className="text-sm text-gray-500">Loading lessons…</p>
              ) : sourceLessons.length === 0 ? (
                <p className="text-sm text-gray-500">Selected module has no lessons yet.</p>
              ) : (
                <div className="space-y-3">
                  <div className="border border-gray-200 dark:border-gray-800 rounded-xl">
                    <div className="px-3 py-2 text-sm font-semibold bg-gray-50 dark:bg-gray-900 rounded-t-xl">
                      Lessons
                    </div>
                    <div className="p-3 space-y-2">
                      {sourceLessons.map((lesson) => (
                        <label
                          key={lesson.id}
                          className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition ${
                            selectedLessonIds.has(lesson.id)
                              ? 'border-transparent ring-2 ring-offset-2 ring-purple-500 dark:ring-offset-gray-950'
                              : 'border-gray-200 dark:border-gray-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={selectedLessonIds.has(lesson.id)}
                            onChange={() => toggleLesson(lesson.id)}
                          />
                          <span className="text-sm">{lesson.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={onImportLessons}
                    disabled={importing || selectedLessonIds.size === 0}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold disabled:opacity-50"
                  >
                    {importing ? 'Importing…' : 'Import selected lessons'}
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={onCreateLesson} className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New lesson title…"
              className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
            />
            <button
              disabled={creating || !title.trim()}
              className="px-4 py-2 rounded-xl text-white font-semibold bg-gradient-to-r from-sky-600 to-indigo-600 disabled:opacity-50"
            >
              {creating ? 'Adding…' : 'Add Lesson'}
            </button>
          </form>

          {lessons.length === 0 ? (
            <div className="text-gray-500">No lessons yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {lessons.map((lesson) => {
                const canPublish = course?.isPublished && module?.isPublished;
                const blocked = !lesson.isPublished && !canPublish;
                const parentName = !course?.isPublished
                  ? course?.title || 'the parent course'
                  : !module?.isPublished
                  ? module?.title || 'the parent module'
                  : null;
                const tooltipMessage = blocked && parentName
                  ? `${parentName} is unpublished, so you can't publish ${lesson.title}.`
                  : null;
                const busy = publishingId === lesson.id;
                return (
                  <div
                    key={lesson.id}
                    className="text-left p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/60 hover:shadow-md transition group cursor-pointer flex flex-col h-full"
                    onClick={() => navigate(`/instructor/lesson/${lesson.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/instructor/lesson/${lesson.id}`);
                      }
                    }}
                    >
                      <div className="font-semibold group-hover:underline">{lesson.title}</div>
                      <div className="flex-grow"></div>
                    <div className="mt-4 flex justify-end">
                      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <PublishStatusButton
                          isPublished={lesson.isPublished}
                          pending={busy}
                          blockedReason={tooltipMessage}
                          onClick={() => {
                            if (busy || blocked) return;
                            togglePublish(lesson.id, lesson.isPublished);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
      </div>
  );
}
