import type { FormEvent } from 'react';
import { useOptimistic, useState } from 'react';
import { useNavigate } from 'react-router';
import api from '../lib/api';
import type { Course, Lesson, ModuleDetail } from '../lib/types';
import type { Route } from './+types/instructor.topic';
import { requireClientUser } from '~/lib/client-auth';
import { useLocalUser } from '~/hooks/useLocalUser';
import { Topbar } from '~/components/redesign/Topbar';
import {
  Breadcrumb,
  Btn,
  Card,
  Chip,
  Display,
  Eyebrow,
  Rule,
} from '~/components/redesign/ui';
import { I } from '~/components/redesign/icons';

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
  const { user, logout } = useLocalUser();
  const { course, module, lessons: initialLessons } = loaderData;
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [oLessons, addLessonOpt] = useOptimistic(
    lessons,
    (state, patch: (items: Lesson[]) => Lesson[]) => patch(state),
  );

  // Sync local state with loader updates between visits (React 19 pattern).
  const [prevInitial, setPrevInitial] = useState(initialLessons);
  if (initialLessons !== prevInitial) {
    setPrevInitial(initialLessons);
    setLessons(initialLessons);
  }

  const meta = course.externalMetadata ?? null;
  const code = (meta?.code as string | undefined) || `COURSE ${course.id}`;

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const newLesson = (await api.createLesson(module.id, {
        title: title.trim(),
      })) as Lesson;
      setLessons((prev) => [...prev, newLesson]);
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lesson');
    } finally {
      setCreating(false);
    }
  };

  const togglePublish = async (l: Lesson) => {
    if ((!course.isPublished || !module.isPublished) && !l.isPublished) {
      setError('Publish the parent course and module first.');
      return;
    }
    addLessonOpt((items) =>
      items.map((it) => (it.id === l.id ? { ...it, isPublished: !it.isPublished } : it)),
    );
    setPublishingId(l.id);
    try {
      const updated = l.isPublished
        ? ((await api.unpublishLesson(l.id)) as Lesson)
        : ((await api.publishLesson(l.id)) as Lesson);
      setLessons((prev) => prev.map((it) => (it.id === l.id ? updated : it)));
    } catch (err) {
      setLessons((prev) =>
        prev.map((it) => (it.id === l.id ? { ...it, isPublished: l.isPublished } : it)),
      );
      setError(err instanceof Error ? err.message : 'Could not toggle publish');
    } finally {
      setPublishingId((current) => (current === l.id ? null : current));
    }
  };

  if (!user) return null;

  const publishedCount = oLessons.filter((l) => l.isPublished).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      <Topbar role={user.role} page="instructor" user={user} onLogout={logout} />

      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 32px 64px' }}>
        <Breadcrumb
          items={[
            { label: 'Teaching', onClick: () => navigate('/instructor') },
            { label: code, onClick: () => navigate(`/instructor/courses/${course.id}`) },
            { label: module.title },
          ]}
        />

        <div
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 20,
            alignItems: 'end',
          }}
        >
          <div>
            <Eyebrow>Module · {code}</Eyebrow>
            <Display size={40} style={{ marginTop: 6 }}>
              {module.title}
            </Display>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {module.isPublished ? (
                <Chip tone="ok" icon={I.dot}>
                  published
                </Chip>
              ) : (
                <Chip tone="outline">draft</Chip>
              )}
              <Chip tone="outline">
                {oLessons.length} {oLessons.length === 1 ? 'lesson' : 'lessons'}
              </Chip>
              <Chip tone="outline">{publishedCount} published</Chip>
            </div>
          </div>
        </div>

        <Rule style={{ margin: '24px 0' }} />

        {error && (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(177,66,42,.08)',
              border: '1px solid var(--bad)',
              color: 'var(--bad)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleCreate}>
          <Card
            style={{
              padding: 14,
              marginBottom: 14,
              background: 'var(--paper)',
              borderStyle: 'dashed',
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div
                style={{
                  fontFamily: 'var(--rd-font-mono)',
                  fontSize: 12,
                  color: 'var(--ink-3)',
                  width: 32,
                }}
              >
                L · {String(lessons.length + 1).padStart(2, '0')}
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="New lesson title — e.g. Quicksort"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: 'var(--paper-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: 'var(--rd-font-ui)',
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
              <Btn
                size="sm"
                variant="primary"
                icon={I.plus}
                type="submit"
                disabled={creating || !title.trim()}
              >
                {creating ? 'Adding…' : 'Add'}
              </Btn>
            </div>
          </Card>
        </form>

        {oLessons.length === 0 ? (
          <Card style={{ padding: 28, textAlign: 'center' }}>
            <Display size={20}>No lessons yet.</Display>
            <p style={{ color: 'var(--ink-3)', marginTop: 6, fontSize: 13.5 }}>
              Create your first lesson above.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {oLessons.map((l, i) => (
              <LessonRow
                key={l.id}
                l={l}
                n={i + 1}
                onOpen={() => navigate(`/instructor/lesson/${l.id}`)}
                onTogglePublish={() => togglePublish(l)}
                publishing={publishingId === l.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LessonRow({
  l,
  n,
  onOpen,
  onTogglePublish,
  publishing,
}: {
  l: Lesson;
  n: number;
  onOpen: () => void;
  onTogglePublish: () => void;
  publishing: boolean;
}) {
  return (
    <Card>
      <div
        style={{
          padding: '14px 18px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto auto auto',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div style={{ color: 'var(--ink-4)' }}>{I.drag}</div>
        <div onClick={onOpen} style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: 14.5, fontWeight: 500 }}>{l.title}</div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-3)',
              fontFamily: 'var(--rd-font-mono)',
              marginTop: 2,
              letterSpacing: '.06em',
            }}
          >
            LESSON · {String(n).padStart(2, '0')}
          </div>
        </div>
        {l.isPublished ? (
          <Chip tone="ok" size="sm">
            published
          </Chip>
        ) : (
          <Chip tone="outline" size="sm">
            draft
          </Chip>
        )}
        <Btn
          size="sm"
          variant={l.isPublished ? 'ghost' : 'ember'}
          icon={l.isPublished ? I.eyeOff : I.eye}
          onClick={onTogglePublish}
          disabled={publishing}
        >
          {publishing ? '…' : l.isPublished ? 'Unpublish' : 'Publish'}
        </Btn>
        <Btn size="sm" variant="tonal" icon={I.edit} onClick={onOpen}>
          Edit
        </Btn>
      </div>
    </Card>
  );
}
