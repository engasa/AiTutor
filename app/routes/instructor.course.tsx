import type { FormEvent } from 'react';
import { useOptimistic, useRef, useState } from 'react';
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
import type { Course, Module } from '../lib/types';
import type { Route } from './+types/instructor.course';
import { requireClientUser } from '~/lib/client-auth';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  await requireClientUser('PROFESSOR');
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
  const modulesRequestIdRef = useRef(0);

  const [oModules, addModuleOpt] = useOptimistic(
    modules,
    (state, patch: (items: Module[]) => Module[]) => patch(state),
  );

  // Adjust state during render when loader data changes
  const [prevInitialModules, setPrevInitialModules] = useState(initialModules);
  if (initialModules !== prevInitialModules) {
    setPrevInitialModules(initialModules);
    setModules(initialModules);
  }

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

  const handleSourceCourseSelection = async (nextCourseId: number | null) => {
    const requestId = ++modulesRequestIdRef.current;
    setSelectedSourceCourseId(nextCourseId);
    setSourceModules([]);
    setSelectedModuleIds(new Set());

    if (nextCourseId == null) {
      setLoadingSourceModules(false);
      return;
    }

    setLoadingSourceModules(true);
    try {
      const data = await api.modulesForCourse(nextCourseId);
      if (modulesRequestIdRef.current === requestId) {
        setSourceModules(data);
      }
    } catch (error) {
      if (modulesRequestIdRef.current === requestId) {
        console.error('Failed to load modules for course', error);
        setSourceModules([]);
      }
    } finally {
      if (modulesRequestIdRef.current === requestId) {
        setLoadingSourceModules(false);
      }
    }
  };

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
      await handleSourceCourseSelection(null);
      await refreshModules();
    } catch (error) {
      console.error('Import failed', error);
    } finally {
      setImporting(false);
    }
  };


  const togglePublish = async (moduleId: number, currentlyPublished: boolean) => {
    // Optimistic update via useOptimistic
    addModuleOpt((items) =>
      items.map((m) => (m.id === moduleId ? { ...m, isPublished: !currentlyPublished } : m)),
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
      // Rollback on error to clear optimistic change
      setModules((prev) =>
        prev.map((m) => (m.id === moduleId ? { ...m, isPublished: currentlyPublished } : m)),
      );
    } finally {
      setPublishingId((current) => (current === moduleId ? null : current));
    }
  };

  return (
    <div className="min-h-dvh bg-background">
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
            <h2 className="font-display text-2xl font-semibold text-foreground">Modules</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!showImport) {
                    ensureSourceCoursesLoaded();
                  } else {
                    void handleSourceCourseSelection(null);
                  }
                  setShowImport((prev) => !prev);
                }}
                className="btn-secondary"
              >
                {showImport ? 'Close' : 'Import'}
              </button>
            </div>
          </div>

          {showImport && (
            <div className="card-editorial p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-foreground">Choose course to copy</label>
                <select
                  value={selectedSourceCourseId ?? ''}
                  onChange={(e) => {
                    const nextValue = e.target.value ? Number(e.target.value) : null;
                    void handleSourceCourseSelection(nextValue);
                  }}
                  className="input-field"
                >
                  <option value="">Select course…</option>
                  {availableCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
                {loadingSourceCourses && (
                  <p className="mt-2 text-xs text-muted-foreground">Loading courses…</p>
                )}
                {!loadingSourceCourses && availableCourses.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    You don't have another course to copy from yet.
                  </p>
                )}
              </div>

              {selectedSourceCourseId == null ? (
                <p className="text-sm text-muted-foreground">Select a course to preview its modules.</p>
              ) : loadingSourceModules ? (
                <p className="text-sm text-muted-foreground">Loading modules…</p>
              ) : sourceModules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Selected course has no modules yet.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Select modules to import (lessons and activities included).
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {sourceModules.map((module) => (
                      <label
                        key={module.id}
                        className={`p-4 rounded-xl border cursor-pointer transition ${
                          selectedModuleIds.has(module.id)
                            ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selectedModuleIds.has(module.id)}
                          onChange={() => toggleModuleSelection(module.id)}
                        />
                        <div className="font-semibold text-foreground">{module.title}</div>
                        {module.description && (
                          <div className="text-xs text-muted-foreground mt-1">{module.description}</div>
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
                    className="btn-primary"
                  >
                    {importing ? 'Importing…' : 'Import modules'}
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={onCreateModule} className="flex gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New module title…"
              className="input-field flex-1"
            />
            <button
              disabled={creating || !title.trim()}
              className="btn-primary"
            >
              {creating ? 'Adding…' : 'Add Module'}
            </button>
          </form>

          {oModules.length === 0 ? (
            <div className="text-muted-foreground">No modules yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {oModules.map((m, idx) => {
                const canPublish = course?.isPublished;
                const blocked = !m.isPublished && !canPublish;
                const tooltipMessage = blocked
                  ? `Publish ${m.title} after publishing ${course?.title ?? 'the parent course'}.`
                  : null;
                const busy = publishingId === m.id;
                return (
                  <div
                    key={m.id}
                    className="card-editorial p-5 hover:shadow-lg transition group cursor-pointer flex flex-col h-full animate-fade-up"
                    style={{ animationDelay: `${idx * 50}ms` }}
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
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-semibold text-sm">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{m.title}</div>
                          {m.description && <div className="text-sm text-muted-foreground mt-1">{m.description}</div>}
                        </div>
                      </div>
                      <div className="flex-grow"></div>
                    <div className="mt-4 flex justify-end">
                      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <PublishStatusButton
                          isPublished={m.isPublished}
                          pending={busy}
                          blockedReason={tooltipMessage}
                          onClick={() => {
                            if (busy || blocked) return;
                            togglePublish(m.id, m.isPublished);
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
