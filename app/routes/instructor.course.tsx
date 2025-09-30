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
import { Button } from '../components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { cn } from '~/lib/utils';
import api from '../lib/api';
import type { Course, Module } from '../lib/types';
import type { Route } from './+types/instructor.course';
import { fetchJson, requireUserFromRequest } from '~/lib/server-api';

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserFromRequest(request, 'INSTRUCTOR');
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

export default function InstructorCourseModules({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const numericCourseId = courseId ? Number(courseId) : null;
  const { course, modules: initialModules } = loaderData;
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedSourceCourseId, setSelectedSourceCourseId] = useState<number | null>(null);
  const [sourceModules, setSourceModules] = useState<Module[]>([]);
  const [loadingSourceCourses, setLoadingSourceCourses] = useState(false);
  const [loadingSourceModules, setLoadingSourceModules] = useState(false);
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);

  useEffect(() => {
    setModules(initialModules);
  }, [initialModules]);

  const refreshModules = async () => {
    if (!numericCourseId) return;
    try {
      const modulesData = await api.modulesForCourse(numericCourseId);
      setModules(modulesData);
    } catch (error) {
      console.error('Failed to refresh modules', error);
    }
  };

  const ensureSourceCoursesLoaded = () => {
    if (availableCourses.length > 0) return;
    setLoadingSourceCourses(true);
    api
      .listCourses()
      .then((data: Course[]) => {
        const nextCourses = numericCourseId
          ? data.filter((course: Course) => course.id !== numericCourseId)
          : data;
        setAvailableCourses(nextCourses);
      })
      .catch((error) => console.error('Failed to load courses', error))
      .finally(() => setLoadingSourceCourses(false));
  };

  useEffect(() => {
    if (selectedSourceCourseId == null) {
      setSourceModules([]);
      setSelectedModuleIds(new Set());
      return;
    }

    setLoadingSourceModules(true);
    api
      .modulesForCourse(selectedSourceCourseId)
      .then((data: Module[]) => {
        setSourceModules(data);
        setSelectedModuleIds(new Set());
      })
      .catch((error) => console.error('Failed to load modules for course', error))
      .finally(() => setLoadingSourceModules(false));
  }, [selectedSourceCourseId]);

  const onCreateModule = async (event: FormEvent) => {
    event.preventDefault();
    if (!numericCourseId || !title.trim()) return;
    setCreating(true);
    try {
      await api.createModule(numericCourseId, { title: title.trim() });
      setTitle('');
      await refreshModules();
    } catch (error) {
      console.error('Failed to create module', error);
    } finally {
      setCreating(false);
    }
  };

  const toggleModuleSelection = (moduleId: number) => {
    setSelectedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const onImport = async () => {
    if (!numericCourseId || selectedSourceCourseId == null || selectedModuleIds.size === 0) return;
    setImporting(true);
    try {
      await api.importIntoCourse(numericCourseId, {
        sourceCourseId: selectedSourceCourseId,
        moduleIds: Array.from(selectedModuleIds),
      });
      setShowImport(false);
      setSelectedSourceCourseId(null);
      setSourceModules([]);
      setSelectedModuleIds(new Set());
      await refreshModules();
    } catch (error) {
      console.error('Import failed', error);
    } finally {
      setImporting(false);
    }
  };

  const togglePublish = async (moduleId: number, currentlyPublished: boolean) => {
    // Optimistic update
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, isPublished: !currentlyPublished } : m))
    );
    setPublishingId(moduleId);

    try {
      const updated = currentlyPublished
        ? await api.unpublishModule(moduleId)
        : await api.publishModule(moduleId);
      // Confirm with server response
      setModules((prev) => prev.map((m) => (m.id === moduleId ? updated : m)));
    } catch (error) {
      console.error('Failed to toggle publish status', error);
      // Rollback on error
      setModules((prev) =>
        prev.map((m) => (m.id === moduleId ? { ...m, isPublished: currentlyPublished } : m))
      );
    } finally {
      setPublishingId((current) => (current === moduleId ? null : current));
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
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
                <BreadcrumbPage>{course?.title || 'Course'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Modules</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!showImport) {
                    ensureSourceCoursesLoaded();
                  } else {
                    setSelectedSourceCourseId(null);
                    setSourceModules([]);
                    setSelectedModuleIds(new Set());
                  }
                  setShowImport((prev) => !prev);
                }}
                className="px-3 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold"
              >
                {showImport ? 'Close' : 'Import'}
              </button>
            </div>
          </div>

          {showImport && (
            <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/70 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Choose course to copy</label>
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

              {selectedSourceCourseId == null ? (
                <p className="text-sm text-gray-500">Select a course to preview its modules.</p>
              ) : loadingSourceModules ? (
                <p className="text-sm text-gray-500">Loading modules…</p>
              ) : sourceModules.length === 0 ? (
                <p className="text-sm text-gray-500">Selected course has no modules yet.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Select modules to import (lessons and activities included).
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {sourceModules.map((module) => (
                      <label
                        key={module.id}
                        className={`p-3 rounded-xl border cursor-pointer transition ${
                          selectedModuleIds.has(module.id)
                            ? 'border-transparent ring-2 ring-offset-2 ring-purple-500 dark:ring-offset-gray-950'
                            : 'border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selectedModuleIds.has(module.id)}
                          onChange={() => toggleModuleSelection(module.id)}
                        />
                        <div className="font-semibold">{module.title}</div>
                        {module.description && (
                          <div className="text-xs text-gray-500">{module.description}</div>
                        )}
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={onImport}
                    disabled={
                      importing ||
                      selectedSourceCourseId == null ||
                      selectedModuleIds.size === 0
                    }
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold disabled:opacity-50"
                  >
                    {importing ? 'Importing…' : 'Import modules'}
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={onCreateModule} className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New module title…"
              className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
            />
            <button
              disabled={creating || !title.trim()}
              className="px-4 py-2 rounded-xl text-white font-semibold bg-gradient-to-r from-sky-600 to-indigo-600 disabled:opacity-50"
            >
              {creating ? 'Adding…' : 'Add Module'}
            </button>
          </form>

          {modules.length === 0 ? (
            <div className="text-gray-500">No modules yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {modules.map((m) => {
                const canPublish = course?.isPublished;
                const blocked = !m.isPublished && !canPublish;
                const tooltipMessage = blocked
                  ? `Publish ${m.title} after publishing ${course?.title ?? 'the parent course'}.`
                  : null;
                const busy = publishingId === m.id;
                const button = (
                  <Button
                    size="sm"
                    disabled={busy}
                    aria-disabled={blocked}
                    className={cn(
                      'px-3 py-1.5 text-xs font-semibold transition',
                      m.isPublished
                        ? 'bg-emerald-400 text-emerald-900 hover:bg-emerald-500 dark:bg-emerald-500/80 dark:text-white dark:hover:bg-emerald-500/70'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
                      blocked && 'cursor-not-allowed opacity-60 hover:bg-gray-300/80 dark:hover:bg-gray-700/80',
                      busy && 'cursor-progress',
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (busy || blocked) return;
                      togglePublish(m.id, m.isPublished);
                    }}
                  >
                    {busy ? 'Saving…' : m.isPublished ? 'Published' : 'Unpublished'}
                  </Button>
                );
                return (
                  <div
                    key={m.id}
                    className="text-left p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/60 hover:shadow-md transition group cursor-pointer flex flex-col h-full"
                    onClick={() => navigate(`/instructor/module/${m.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/instructor/module/${m.id}`);
                      }
                    }}
                    >
                      <div className="font-semibold group-hover:underline">{m.title}</div>
                      {m.description && <div className="text-sm text-gray-500 mt-1">{m.description}</div>}
                      <div className="flex-grow"></div>
                    <div className="mt-4 flex justify-end">
                      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        {tooltipMessage ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{button}</TooltipTrigger>
                            <TooltipContent>{tooltipMessage}</TooltipContent>
                          </Tooltip>
                        ) : (
                          button
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
      </div>
    </TooltipProvider>
  );
}
