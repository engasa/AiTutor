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
import type { Course, Lesson, Module, ModuleDetail } from '../lib/types';
import type { Route } from './+types/instructor.topic';
import { requireClientUser } from '~/lib/client-auth';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  await requireClientUser('PROFESSOR');
  const moduleId = Number(params.moduleId);
  if (!Number.isFinite(moduleId)) {
    throw new Response('Invalid module id', { status: 400 });
  }

  const [module, lessons] = await Promise.all([
    api.moduleById(moduleId) as Promise<ModuleDetail>,
    api.lessonsForModule(moduleId) as Promise<Lesson[]>,
  ]);

  const course = (await api.courseById(module.courseOfferingId)) as Course;

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
  const sourceModulesRequestIdRef = useRef(0);
  const sourceLessonsRequestIdRef = useRef(0);

  const [oLessons, addLessonOpt] = useOptimistic(
    lessons,
    (state, patch: (items: Lesson[]) => Lesson[]) => patch(state),
  );

  const [prevInitialLessons, setPrevInitialLessons] = useState(initialLessons);
  if (initialLessons !== prevInitialLessons) {
    setPrevInitialLessons(initialLessons);
    setLessons(initialLessons);
  }

  const refreshLessons = async () => {
    if (!numericModuleId) return;
    const lessonData = await api.lessonsForModule(numericModuleId);
    setLessons(lessonData);
  };

  const ensureSourceCoursesLoaded = () => {
    if (availableCourses.length > 0) return;
    setLoadingSourceCourses(true);
    api
      .listCourses()
      .then((data: Course[]) => {
        const nextCourses = module.courseOfferingId
          ? data.filter((item) => item.id !== module.courseOfferingId)
          : data;
        setAvailableCourses(nextCourses);
      })
      .finally(() => setLoadingSourceCourses(false));
  };

  const handleSourceCourseSelection = async (nextCourseId: number | null) => {
    const courseRequestId = ++sourceModulesRequestIdRef.current;
    ++sourceLessonsRequestIdRef.current;

    setSelectedSourceCourseId(nextCourseId);
    setSourceModules([]);
    setSelectedSourceModuleId(null);
    setSourceLessons([]);
    setSelectedLessonIds(new Set());

    if (nextCourseId == null) {
      setLoadingSourceModules(false);
      setLoadingSourceLessons(false);
      return;
    }

    setLoadingSourceModules(true);
    try {
      const modulesData = await api.modulesForCourse(nextCourseId);
      if (sourceModulesRequestIdRef.current === courseRequestId) {
        setSourceModules(modulesData);
      }
    } finally {
      if (sourceModulesRequestIdRef.current === courseRequestId) {
        setLoadingSourceModules(false);
      }
    }
  };

  const handleSourceModuleSelection = async (nextModuleId: number | null) => {
    const lessonRequestId = ++sourceLessonsRequestIdRef.current;

    setSelectedSourceModuleId(nextModuleId);
    setSourceLessons([]);
    setSelectedLessonIds(new Set());

    if (nextModuleId == null) {
      setLoadingSourceLessons(false);
      return;
    }

    setLoadingSourceLessons(true);
    try {
      const lessonData = await api.lessonsForModule(nextModuleId);
      if (sourceLessonsRequestIdRef.current === lessonRequestId) {
        setSourceLessons(lessonData);
      }
    } finally {
      if (sourceLessonsRequestIdRef.current === lessonRequestId) {
        setLoadingSourceLessons(false);
      }
    }
  };

  const onCreateLesson = async (event: FormEvent) => {
    event.preventDefault();
    if (!numericModuleId || !title.trim()) return;
    setCreating(true);
    try {
      await api.createLesson(numericModuleId, { title: title.trim() });
      setTitle('');
      await refreshLessons();
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
    if (!numericModuleId || selectedSourceModuleId == null || selectedLessonIds.size === 0) return;
    setImporting(true);
    try {
      await api.importIntoCourse(module.courseOfferingId, {
        lessonIds: Array.from(selectedLessonIds),
        targetModuleId: numericModuleId,
      });
      setShowImport(false);
      await handleSourceCourseSelection(null);
      await refreshLessons();
    } finally {
      setImporting(false);
    }
  };

  const togglePublish = async (lessonId: number, currentlyPublished: boolean) => {
    addLessonOpt((items) =>
      items.map((lesson) =>
        lesson.id === lessonId ? { ...lesson, isPublished: !currentlyPublished } : lesson,
      ),
    );
    setPublishingId(lessonId);

    try {
      const updated = currentlyPublished
        ? await api.unpublishLesson(lessonId)
        : await api.publishLesson(lessonId);
      setLessons((prev) => prev.map((item) => (item.id === lessonId ? updated : item)));
    } catch {
      setLessons((prev) =>
        prev.map((item) =>
          item.id === lessonId ? { ...item, isPublished: currentlyPublished } : item,
        ),
      );
    } finally {
      setPublishingId((current) => (current === lessonId ? null : current));
    }
  };

  const blockedReason = !course.isPublished
    ? 'Publish the course before publishing lessons.'
    : !module.isPublished
      ? 'Publish the module before publishing lessons.'
      : null;

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
              <BreadcrumbLink asChild>
                <Link to={`/instructor/courses/${course.id}`} className="hover:text-white">
                  {course.title}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-white/24">/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-white">{module.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <DashboardHero
          eyebrow={<SectionEyebrow tone="cool">Module authoring</SectionEyebrow>}
          title={module.title}
          description="Build lesson sequences, import from other modules, and manage publish state with better editorial rhythm."
          actions={
            <button
              type="button"
              onClick={() => setShowImport((prev) => !prev)}
              className="btn-secondary"
            >
              <FolderInput className="h-4 w-4" />
              {showImport ? 'Close import' : 'Import lessons'}
            </button>
          }
          aside={
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <StatPill label="Lessons" value={lessons.length} />
              <StatPill
                label="Published"
                value={lessons.filter((lesson) => lesson.isPublished).length}
              />
              <StatPill label="Module state" value={module.isPublished ? 'Live' : 'Draft'} />
            </div>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <DashboardCard>
            <SectionEyebrow tone="warm">Create lesson</SectionEyebrow>
            <form onSubmit={onCreateLesson} className="mt-6 space-y-4">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="input-field"
                placeholder="New lesson title"
              />
              <button type="submit" className="btn-primary" disabled={creating || !title.trim()}>
                <Plus className="h-4 w-4" />
                {creating ? 'Creating…' : 'Create lesson'}
              </button>
            </form>
          </DashboardCard>

          {showImport ? (
            <DashboardCard>
              <SectionEyebrow tone="cool">Cross-module import</SectionEyebrow>
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

                <select
                  className="input-field"
                  value={selectedSourceModuleId ?? ''}
                  onChange={(event) =>
                    void handleSourceModuleSelection(
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                >
                  <option value="">Choose source module</option>
                  {sourceModules.map((item) => (
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
                {loadingSourceLessons ? (
                  <div className="text-sm text-white/52">Loading lessons…</div>
                ) : null}

                <div className="grid gap-3">
                  {sourceLessons.map((lesson) => (
                    <label
                      key={lesson.id}
                      className="flex items-center gap-3 rounded-[1.1rem] border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/78"
                    >
                      <input
                        type="checkbox"
                        checked={selectedLessonIds.has(lesson.id)}
                        onChange={() => toggleLesson(lesson.id)}
                      />
                      <span>{lesson.title}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void onImportLessons()}
                  disabled={importing || selectedLessonIds.size === 0}
                  className="btn-primary"
                >
                  <CopyPlus className="h-4 w-4" />
                  {importing ? 'Importing…' : 'Import selected lessons'}
                </button>
              </div>
            </DashboardCard>
          ) : null}
        </div>

        <DashboardGrid>
          {oLessons.map((lesson) => (
            <DashboardCard key={lesson.id} interactive className="glow h-full">
              <div className="flex items-start justify-between gap-4">
                <div className="tag">{`Lesson ${lesson.position + 1}`}</div>
                <PublishStatusButton
                  isPublished={lesson.isPublished}
                  pending={publishingId === lesson.id}
                  blockedReason={blockedReason}
                  onClick={() => void togglePublish(lesson.id, lesson.isPublished)}
                />
              </div>
              <button
                type="button"
                onClick={() => navigate(`/instructor/lesson/${lesson.id}`)}
                className="mt-6 w-full text-left"
              >
                <h2 className="text-2xl font-semibold tracking-[-0.05em] text-white">
                  {lesson.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/62">
                  Open the lesson builder to manage activities, topics, and AI modes inside the new
                  studio shell.
                </p>
                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-amber-100">
                  Open lesson builder
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
