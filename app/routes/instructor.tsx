import { useOptimistic, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Compass, Import, RefreshCcw, Sparkles } from 'lucide-react';
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
import { PublishStatusButton } from '../components/PublishStatusButton';
import api from '../lib/api';
import type { Course, EduAiCourse } from '../lib/types';
import type { Route } from './+types/instructor';
import { requireClientUser } from '~/lib/client-auth';

export async function clientLoader(_: Route.ClientLoaderArgs) {
  await requireClientUser('PROFESSOR');
  const courses = (await api.listCourses()) as Course[];
  return { courses };
}

export default function InstructorHome({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>(loaderData.courses ?? []);
  const [showEduAiImport, setShowEduAiImport] = useState(false);
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
        return error.message;
      }
      return error.message;
    }
    return 'Something went wrong. Please try again.';
  };

  const loadCourses = async () => {
    const data: Course[] = await api.listCourses();
    setCourses(data);
  };

  const fetchEduAiCourses = async () => {
    setLoadingEduAiCourses(true);
    setEduAiError(null);
    try {
      const data = (await api.listEduAiCourses()) as EduAiCourse[];
      setEduAiCourses(data);
    } catch (error) {
      setEduAiError(parseErrorMessage(error));
    } finally {
      setLoadingEduAiCourses(false);
    }
  };

  const ensureEduAiCourses = () => {
    if (eduAiCourses.length > 0 || loadingEduAiCourses) return;
    void fetchEduAiCourses();
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
      setEduAiError(parseErrorMessage(error));
    } finally {
      setImportingExternalId((current) => (current === externalCourseId ? null : current));
    }
  };

  const togglePublish = async (courseId: number, currentlyPublished: boolean) => {
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
      setCourses((prev) => prev.map((course) => (course.id === courseId ? updated : course)));
    } catch {
      setCourses((prev) =>
        prev.map((course) =>
          course.id === courseId ? { ...course, isPublished: currentlyPublished } : course,
        ),
      );
    } finally {
      setPublishingId((current) => (current === courseId ? null : current));
    }
  };

  return (
    <main className="app-shell">
      <AppBackdrop pattern="mesh" />
      <Nav />

      <AppContainer className="space-y-8 pb-12 pt-8">
        <DashboardHero
          eyebrow={<SectionEyebrow tone="warm">Instructor studio</SectionEyebrow>}
          title={
            <>
              Author courses in a space that feels
              <span className="text-gradient"> deliberate.</span>
            </>
          }
          description="Publishing, imports, and curriculum structure now sit inside a stronger editorial shell so teaching workflows feel composed rather than crowded."
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setShowEduAiImport((prev) => {
                    const next = !prev;
                    if (next) ensureEduAiCourses();
                    return next;
                  });
                }}
                className="btn-primary"
              >
                <Import className="h-4 w-4" />
                {showEduAiImport ? 'Close import' : 'Import from EduAI'}
              </button>
              <button type="button" onClick={() => void loadCourses()} className="btn-secondary">
                <RefreshCcw className="h-4 w-4" />
                Refresh courses
              </button>
            </>
          }
          aside={
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <StatPill label="Courses" value={courses.length} />
              <StatPill
                label="Published"
                value={courses.filter((course) => course.isPublished).length}
              />
              <StatPill label="Imports ready" value={eduAiCourses.length} />
            </div>
          }
        />

        {showEduAiImport ? (
          <DashboardCard className="p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <SectionEyebrow tone="cool">EduAI import</SectionEyebrow>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white">
                  Pull in external course shells
                </h2>
                <p className="mt-3 max-w-2xl text-white/62">
                  Import the course card first, then keep building modules, lessons, and activities
                  inside the redesigned authoring flow.
                </p>
              </div>
              <button type="button" onClick={fetchEduAiCourses} className="btn-secondary">
                <RefreshCcw className={`h-4 w-4 ${loadingEduAiCourses ? 'animate-spin' : ''}`} />
                Reload source courses
              </button>
            </div>

            {eduAiError ? (
              <div className="mt-6 rounded-[1.2rem] border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                {eduAiError}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {loadingEduAiCourses ? (
                <div className="text-sm text-white/56">Loading external courses…</div>
              ) : eduAiCourses.length === 0 ? (
                <div className="text-sm text-white/56">
                  No EduAI courses are currently available to import.
                </div>
              ) : (
                eduAiCourses.map((course) => (
                  <DashboardCard key={course.id} interactive className="h-full">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/12 bg-white/8">
                        <Compass className="h-5 w-5 text-cyan-200" />
                      </div>
                      <div className="tag tag-accent">{course.code || course.term || 'EduAI'}</div>
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold tracking-[-0.05em] text-white">
                      {course.name || 'Untitled external course'}
                    </h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/62">
                      {course.description ||
                        'Import this course shell and continue authoring inside AI Tutor.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void importEduAiCourse(course.id)}
                      disabled={importingExternalId === course.id}
                      className="btn-primary mt-6 w-full"
                    >
                      {importingExternalId === course.id ? 'Importing…' : 'Import course'}
                    </button>
                  </DashboardCard>
                ))
              )}
            </div>
          </DashboardCard>
        ) : null}

        <DashboardGrid>
          {oCourses.map((course) => (
            <DashboardCard key={course.id} interactive className="glow h-full">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/12 bg-white/8">
                  <Sparkles className="h-5 w-5 text-amber-200" />
                </div>
                <PublishStatusButton
                  isPublished={course.isPublished}
                  pending={publishingId === course.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    void togglePublish(course.id, course.isPublished);
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => navigate(`/instructor/courses/${course.id}`)}
                className="mt-6 w-full text-left"
              >
                <h2 className="text-2xl font-semibold tracking-[-0.05em] text-white">
                  {course.title}
                </h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/62">
                  {course.description ||
                    'Open the course to manage modules, publishing, and authoring flow.'}
                </p>
                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-amber-100">
                  Enter course studio
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
