import { useOptimistic, useState } from 'react';
import { useNavigate } from 'react-router';
import api from '../lib/api';
import type { Course, EduAiCourse } from '../lib/types';
import type { Route } from './+types/instructor';
import { requireClientUser } from '~/lib/client-auth';
import { useLocalUser } from '~/hooks/useLocalUser';
import { Topbar } from '~/components/redesign/Topbar';
import {
  Btn,
  Card,
  Chip,
  Display,
  Eyebrow,
  Rule,
} from '~/components/redesign/ui';
import { I } from '~/components/redesign/icons';

export async function clientLoader(_: Route.ClientLoaderArgs) {
  await requireClientUser('PROFESSOR');
  const courses = (await api.listCourses()) as Course[];
  return { courses };
}

function parseError(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed === 'object' && typeof parsed.error === 'string') {
        return parsed.error;
      }
    } catch {
      // Plain message — fall through.
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export default function InstructorHome({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { user, logout } = useLocalUser();
  const [courses, setCourses] = useState<Course[]>(loaderData.courses ?? []);
  const [showImport, setShowImport] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [eduAiCourses, setEduAiCourses] = useState<EduAiCourse[]>([]);
  const [loadingEduAi, setLoadingEduAi] = useState(false);
  const [importingExternal, setImportingExternal] = useState<string | null>(null);
  const [eduAiError, setEduAiError] = useState<string | null>(null);

  const [oCourses, addCourseOpt] = useOptimistic(
    courses,
    (state, patch: (items: Course[]) => Course[]) => patch(state),
  );

  const refreshCourses = async () => {
    try {
      const data = (await api.listCourses()) as Course[];
      setCourses(data);
    } catch (error) {
      console.error('Failed to refresh courses', error);
    }
  };

  const fetchEduAi = async () => {
    setLoadingEduAi(true);
    setEduAiError(null);
    try {
      const data = (await api.listEduAiCourses()) as EduAiCourse[];
      setEduAiCourses(data);
    } catch (error) {
      setEduAiError(parseError(error));
    } finally {
      setLoadingEduAi(false);
    }
  };

  const ensureEduAi = () => {
    if (eduAiCourses.length > 0 || loadingEduAi) return;
    fetchEduAi();
  };

  const importEduAi = async (externalCourseId: string) => {
    if (!externalCourseId) return;
    setImportingExternal(externalCourseId);
    setEduAiError(null);
    try {
      await api.importEduAiCourse({ externalCourseId });
      setEduAiCourses((prev) => prev.filter((c) => c.id !== externalCourseId));
      await refreshCourses();
    } catch (error) {
      setEduAiError(parseError(error));
    } finally {
      setImportingExternal((current) => (current === externalCourseId ? null : current));
    }
  };

  const togglePublish = async (courseId: number, currentlyPublished: boolean) => {
    addCourseOpt((items) =>
      items.map((c) => (c.id === courseId ? { ...c, isPublished: !currentlyPublished } : c)),
    );
    setPublishingId(courseId);
    try {
      const updated = currentlyPublished
        ? await api.unpublishCourse(courseId)
        : await api.publishCourse(courseId);
      setCourses((prev) => prev.map((c) => (c.id === courseId ? updated : c)));
    } catch (error) {
      console.error('Failed to toggle publish', error);
      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? { ...c, isPublished: currentlyPublished } : c)),
      );
    } finally {
      setPublishingId((current) => (current === courseId ? null : current));
    }
  };

  if (!user) return null;

  const publishedCount = oCourses.filter((c) => c.isPublished).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      <Topbar role={user.role} page="instructor" user={user} onLogout={logout} />

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '40px 32px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'end',
            gap: 24,
            marginBottom: 32,
          }}
        >
          <div>
            <Eyebrow>Teaching · Spring 2026</Eyebrow>
            <Display size={48} style={{ marginTop: 10 }}>
              Your courses.
            </Display>
            <p style={{ color: 'var(--ink-3)', marginTop: 10, maxWidth: 560, fontSize: 15 }}>
              Build, publish, and refine. Imports from EduAI keep topics and enrollments aligned.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" icon={I.refresh} onClick={refreshCourses}>
              Refresh
            </Btn>
            <Btn
              variant="primary"
              icon={I.plus}
              onClick={() => {
                setShowImport((prev) => {
                  const next = !prev;
                  if (next) ensureEduAi();
                  else setEduAiError(null);
                  return next;
                });
              }}
            >
              {showImport ? 'Close import' : 'New course'}
            </Btn>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 14,
            marginBottom: 32,
          }}
        >
          {[
            { k: String(oCourses.length), l: 'Active courses', s: `${publishedCount} published` },
            { k: '—', l: 'Enrolled students', s: 'sync to update' },
            { k: '—', l: 'Activities authored', s: 'across all lessons' },
            { k: '—', l: 'Avg. AI leak flags', s: 'supervisor data' },
          ].map((s, i) => (
            <Card key={i} style={{ padding: 18 }}>
              <Eyebrow>{s.l}</Eyebrow>
              <div
                style={{
                  fontFamily: 'var(--rd-font-display)',
                  fontSize: 36,
                  marginTop: 4,
                  lineHeight: 1,
                }}
              >
                {s.k}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: 'var(--ink-3)',
                  fontFamily: 'var(--rd-font-mono)',
                }}
              >
                {s.s}
              </div>
            </Card>
          ))}
        </div>

        {showImport && (
          <Card style={{ padding: 22, marginBottom: 24, borderColor: 'var(--ember)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Chip tone="ember" icon={I.network}>
                EduAI Catalog
              </Chip>
              <Eyebrow>Import an existing course</Eyebrow>
              <span style={{ marginLeft: 'auto' }}>
                <Btn
                  size="sm"
                  variant="ghost"
                  icon={I.refresh}
                  onClick={fetchEduAi}
                  disabled={loadingEduAi}
                >
                  Refresh
                </Btn>
              </span>
            </div>

            {eduAiError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(177,66,42,.08)',
                  border: '1px solid var(--bad)',
                  color: 'var(--bad)',
                  fontSize: 13,
                }}
              >
                {eduAiError}
              </div>
            )}

            {loadingEduAi ? (
              <div
                style={{
                  padding: 32,
                  textAlign: 'center',
                  color: 'var(--ink-3)',
                  fontFamily: 'var(--rd-font-mono)',
                  fontSize: 12,
                }}
              >
                LOADING CATALOG…
              </div>
            ) : eduAiCourses.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  color: 'var(--ink-3)',
                  fontSize: 13,
                }}
              >
                No external courses available right now.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {eduAiCourses.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '12px 14px',
                      border: '1px dashed var(--line-2)',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 13.5, lineHeight: 1.3 }}>
                      <div style={{ fontWeight: 600 }}>{c.code || c.id}</div>
                      <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{c.name || '—'}</div>
                    </div>
                    <Btn
                      size="sm"
                      variant="tonal"
                      onClick={() => importEduAi(c.id)}
                      disabled={importingExternal === c.id}
                    >
                      {importingExternal === c.id ? 'Importing…' : 'Import'}
                    </Btn>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <Rule style={{ margin: '8px 0 22px' }} />

        {oCourses.length === 0 ? (
          <Card style={{ padding: 40, textAlign: 'center' }}>
            <Display size={28}>No courses yet.</Display>
            <p style={{ marginTop: 8, color: 'var(--ink-3)' }}>
              Import one from EduAI to get started.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {oCourses.map((c) => (
              <InstructorCourseCard
                key={c.id}
                course={c}
                onOpen={() => navigate(`/instructor/courses/${c.id}`)}
                onTogglePublish={() => togglePublish(c.id, c.isPublished)}
                publishing={publishingId === c.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InstructorCourseCard({
  course,
  onOpen,
  onTogglePublish,
  publishing,
}: {
  course: Course;
  onOpen: () => void;
  onTogglePublish: () => void;
  publishing: boolean;
}) {
  const meta = course.externalMetadata ?? null;
  const code = (meta?.code as string | undefined) || `COURSE ${course.id}`;
  const description = course.description || (meta?.description as string | undefined) || '';

  return (
    <Card style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <Chip tone="ember">{code}</Chip>
        {course.isPublished ? (
          <Chip tone="ok" icon={I.dot}>
            published
          </Chip>
        ) : (
          <Chip tone="outline">draft</Chip>
        )}
      </div>
      <Display size={22}>{course.title}</Display>
      <p style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 6, flex: 1 }}>{description}</p>

      <div
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          padding: '10px 0',
          borderTop: '1px dashed var(--line)',
          borderBottom: '1px dashed var(--line)',
        }}
      >
        {[
          { k: course.progress?.total ?? '—', l: 'activities' },
          { k: course.isPublished ? 'live' : 'draft', l: 'state' },
          { k: meta?.term ? String(meta.term).split(' ')[0] : '—', l: 'term' },
        ].map((s, i) => (
          <div key={i}>
            <div
              style={{ fontFamily: 'var(--rd-font-display)', fontSize: 20, lineHeight: 1 }}
            >
              {s.k}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--ink-3)',
                fontFamily: 'var(--rd-font-mono)',
                letterSpacing: '.08em',
              }}
            >
              {s.l}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <Btn size="sm" variant="primary" onClick={onOpen}>
          Open
        </Btn>
        <Btn
          size="sm"
          variant={course.isPublished ? 'ghost' : 'ember'}
          icon={course.isPublished ? I.eyeOff : I.eye}
          onClick={onTogglePublish}
          disabled={publishing}
        >
          {publishing ? '…' : course.isPublished ? 'Unpublish' : 'Publish'}
        </Btn>
      </div>
    </Card>
  );
}
