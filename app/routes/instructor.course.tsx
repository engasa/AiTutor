import type { FormEvent } from 'react';
import { useOptimistic, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowRight, CopyPlus, FolderInput, Plus } from 'lucide-react';
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
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

  const [prevInitialModules, setPrevInitialModules] = useState(initialModules);
  if (initialModules !== prevInitialModules) {
    setPrevInitialModules(initialModules);
    setModules(initialModules);
  }

  const refreshModules = async () => {
    if (!numericCourseId) return;
    const modulesData = await api.modulesForCourse(numericCourseId);
    setModules(modulesData);
  };

  const ensureSourceCoursesLoaded = () => {
    if (availableCourses.length > 0) return;
    setLoadingSourceCourses(true);
    api
      .listCourses()
      .then((data: Course[]) => {
        const nextCourses = numericCourseId
          ? data.filter((item) => item.id !== numericCourseId)
          : data;
        setAvailableCourses(nextCourses);
      })
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
    } finally {
      setImporting(false);
    }
  };

  const togglePublish = async (moduleId: number, currentlyPublished: boolean) => {
    addModuleOpt((items) =>
      items.map((module) =>
        module.id === moduleId ? { ...module, isPublished: !currentlyPublished } : module,
      ),
    );
    setPublishingId(moduleId);

    try {
      const updated = currentlyPublished
        ? await api.unpublishModule(moduleId)
        : await api.publishModule(moduleId);
      setModules((prev) => prev.map((item) => (item.id === moduleId ? updated : item)));
    } catch {
      setModules((prev) =>
        prev.map((item) =>
          item.id === moduleId ? { ...item, isPublished: currentlyPublished } : item,
        ),
      );
    } finally {
      setPublishingId((current) => (current === moduleId ? null : current));
    }
  };

  return (
    <main className="app-shell">
      <AppBackdrop pattern="mesh" />
      <Nav />

      <AppContainer className="space-y-8 pb-12 pt-8">
        <Breadcrumb className="px-1 text-white/54">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/instructor" className="hover:text-white">
                  Teaching
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
          eyebrow={<SectionEyebrow tone="warm">Course studio</SectionEyebrow>}
          title={course.title}
          description="Create modules, pull structure from other courses, and control publish state inside a stronger authoring layout."
          actions={
            <>
              <button
                type="button"
                onClick={() => setShowImport((prev) => !prev)}
                className="btn-secondary"
              >
                <FolderInput className="h-4 w-4" />
                {showImport ? 'Close import' : 'Import modules'}
              </button>
            </>
          }
          aside={
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <StatPill label="Modules" value={modules.length} />
              <StatPill
                label="Published"
                value={modules.filter((module) => module.isPublished).length}
              />
              <StatPill label="Course state" value={course.isPublished ? 'Live' : 'Draft'} />
            </div>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <DashboardCard>
            <SectionEyebrow tone="cool">Create module</SectionEyebrow>
            <form onSubmit={onCreateModule} className="mt-6 space-y-4">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="input-field"
                placeholder="New module title"
              />
              <button type="submit" className="btn-primary" disabled={creating || !title.trim()}>
                <Plus className="h-4 w-4" />
                {creating ? 'Creating…' : 'Create module'}
              </button>
            </form>
          </DashboardCard>

          {showImport ? (
            <DashboardCard>
              <SectionEyebrow tone="warm">Cross-course import</SectionEyebrow>
              <div className="mt-6 grid gap-4">
                <select
                  className="input-field"
                  value={selectedSourceCourseId ?? ''}
                  onFocus={ensureSourceCoursesLoaded}
                  onChange={(event) =>
                    void handleSourceCourseSelection(
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                >
                  <option value="">Choose source course</option>
                  {availableCourses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
                {loadingSourceCourses ? (
                  <div className="text-sm text-white/52">Loading courses…</div>
                ) : null}
                {loadingSourceModules ? (
                  <div className="text-sm text-white/52">Loading modules…</div>
                ) : null}
                <div className="grid gap-3">
                  {sourceModules.map((module) => (
                    <label
                      key={module.id}
                      className="flex items-center gap-3 rounded-[1.1rem] border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/78"
                    >
                      <input
                        type="checkbox"
                        checked={selectedModuleIds.has(module.id)}
                        onChange={() => toggleModuleSelection(module.id)}
                      />
                      <span>{module.title}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void onImport()}
                  disabled={importing || selectedModuleIds.size === 0}
                  className="btn-primary"
                >
                  <CopyPlus className="h-4 w-4" />
                  {importing ? 'Importing…' : 'Import selected modules'}
                </button>
              </div>
            </DashboardCard>
          ) : null}
        </div>

        <DashboardGrid>
          {oModules.map((module) => (
            <DashboardCard key={module.id} interactive className="glow h-full">
              <div className="flex items-start justify-between gap-4">
                <div className="tag">{`Module ${module.position + 1}`}</div>
                <PublishStatusButton
                  isPublished={module.isPublished}
                  pending={publishingId === module.id}
                  blockedReason={
                    !course.isPublished ? 'Publish the course before publishing modules.' : null
                  }
                  onClick={() => void togglePublish(module.id, module.isPublished)}
                />
              </div>
              <button
                type="button"
                onClick={() => navigate(`/instructor/module/${module.id}`)}
                className="mt-6 w-full text-left"
              >
                <h2 className="text-2xl font-semibold tracking-[-0.05em] text-white">
                  {module.title}
                </h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/62">
                  {module.description ||
                    'Open this module to create lessons and refine the published learning path.'}
                </p>
                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-amber-100">
                  Open module builder
                  <ArrowRight className="h-4 w-4" />
                </div>
              </button>
            </DashboardCard>
          ))}
        </DashboardGrid>
      </AppContainer>
    </main>
  );
}
