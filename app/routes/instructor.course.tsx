import type { FormEvent } from 'react';
import { useOptimistic, useState } from 'react';
import { useNavigate } from 'react-router';
import api from '../lib/api';
import type { Course, Module } from '../lib/types';
import type { Route } from './+types/instructor.course';
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
  const { user, logout } = useLocalUser();
  const { course, modules: initialModules } = loaderData;
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [oModules, addModuleOpt] = useOptimistic(
    modules,
    (state, patch: (items: Module[]) => Module[]) => patch(state),
  );

  const meta = course.externalMetadata ?? null;
  const code = (meta?.code as string | undefined) || `COURSE ${course.id}`;
  const description = course.description || (meta?.description as string | undefined) || '';

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const newModule = (await api.createModule(course.id, {
        title: title.trim(),
      })) as Module;
      setModules((prev) => [...prev, newModule]);
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create module');
    } finally {
      setCreating(false);
    }
  };

  const togglePublish = async (m: Module) => {
    if (!course.isPublished && !m.isPublished) {
      setError('Publish the course first to publish individual modules.');
      return;
    }
    addModuleOpt((items) =>
      items.map((it) => (it.id === m.id ? { ...it, isPublished: !it.isPublished } : it)),
    );
    setPublishingId(m.id);
    try {
      const updated = m.isPublished
        ? ((await api.unpublishModule(m.id)) as Module)
        : ((await api.publishModule(m.id)) as Module);
      setModules((prev) => prev.map((it) => (it.id === m.id ? updated : it)));
    } catch (err) {
      setModules((prev) =>
        prev.map((it) => (it.id === m.id ? { ...it, isPublished: m.isPublished } : it)),
      );
      setError(err instanceof Error ? err.message : 'Could not toggle publish');
    } finally {
      setPublishingId((current) => (current === m.id ? null : current));
    }
  };

  if (!user) return null;

  const publishedCount = oModules.filter((m) => m.isPublished).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      <Topbar role={user.role} page="instructor" user={user} onLogout={logout} />

      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 32px 64px' }}>
        <Breadcrumb
          items={[
            { label: 'Teaching', onClick: () => navigate('/instructor') },
            { label: code },
          ]}
        />

        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gap: 40,
            alignItems: 'start',
          }}
        >
          <div>
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
            <Display size={42}>{course.title}</Display>
            {description && (
              <p
                style={{
                  color: 'var(--ink-3)',
                  fontSize: 15,
                  marginTop: 10,
                  maxWidth: 640,
                }}
              >
                {description}
              </p>
            )}

            <Rule style={{ margin: '28px 0 18px' }} />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <Display size={24}>Modules</Display>
              <Eyebrow>{publishedCount} published</Eyebrow>
            </div>

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
                      fontFamily: 'var(--rd-font-display)',
                      fontSize: 22,
                      color: 'var(--ink-3)',
                      width: 32,
                    }}
                  >
                    {String(modules.length + 1).padStart(2, '0')}
                  </div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="New module title — e.g. Greedy Algorithms"
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

            {oModules.length === 0 ? (
              <Card style={{ padding: 28, textAlign: 'center' }}>
                <Display size={20}>No modules yet.</Display>
                <p style={{ color: 'var(--ink-3)', marginTop: 6, fontSize: 13.5 }}>
                  Create the first module above.
                </p>
              </Card>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {oModules.map((m, i) => (
                  <ModuleRow
                    key={m.id}
                    m={m}
                    n={i + 1}
                    onOpen={() => navigate(`/instructor/module/${m.id}`)}
                    onTogglePublish={() => togglePublish(m)}
                    publishing={publishingId === m.id}
                  />
                ))}
              </div>
            )}
          </div>

          <div style={{ position: 'sticky', top: 100, height: 'fit-content' }}>
            <Card style={{ padding: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Eyebrow>Course details</Eyebrow>
                <Chip tone={course.isPublished ? 'ok' : 'outline'} size="sm">
                  {course.isPublished ? 'live' : 'draft'}
                </Chip>
              </div>
              <Display size={22} style={{ marginTop: 6 }}>
                {oModules.length} {oModules.length === 1 ? 'module' : 'modules'}
              </Display>
              <Rule style={{ margin: '14px 0' }} />
              <div style={{ display: 'grid', gap: 6, fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-3)' }}>Term</span>
                  <b>{(meta?.term as string | undefined) || '—'}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-3)' }}>External ID</span>
                  <b style={{ fontFamily: 'var(--rd-font-mono)' }}>
                    {course.externalId || '—'}
                  </b>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleRow({
  m,
  n,
  onOpen,
  onTogglePublish,
  publishing,
}: {
  m: Module;
  n: number;
  onOpen: () => void;
  onTogglePublish: () => void;
  publishing: boolean;
}) {
  return (
    <Card>
      <div
        style={{
          padding: '18px 20px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto auto auto',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <div style={{ color: 'var(--ink-4)' }}>{I.drag}</div>
        <div onClick={onOpen} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span
              style={{
                fontFamily: 'var(--rd-font-mono)',
                fontSize: 11,
                color: 'var(--ink-3)',
              }}
            >
              MOD · {String(n).padStart(2, '0')}
            </span>
            {m.isPublished ? (
              <Chip tone="ok" size="sm">
                published
              </Chip>
            ) : (
              <Chip tone="outline" size="sm">
                draft
              </Chip>
            )}
          </div>
          <div style={{ fontFamily: 'var(--rd-font-display)', fontSize: 22, marginTop: 2 }}>
            {m.title}
          </div>
          {m.description && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
              {m.description}
            </div>
          )}
        </div>
        <Btn
          size="sm"
          variant={m.isPublished ? 'ghost' : 'primary'}
          icon={m.isPublished ? I.eyeOff : I.eye}
          onClick={onTogglePublish}
          disabled={publishing}
        >
          {publishing ? '…' : m.isPublished ? 'Unpublish' : 'Publish'}
        </Btn>
        <Btn size="sm" variant="tonal" icon={I.layers} onClick={onOpen}>
          Open
        </Btn>
        <div style={{ color: 'var(--ink-3)' }}>{I.chevR}</div>
      </div>
    </Card>
  );
}
