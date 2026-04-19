import { useNavigate } from 'react-router';
import type { Course, Module } from '../lib/types';
import type { Route } from './+types/student.course';
import api from '~/lib/api';
import { requireClientUser } from '~/lib/client-auth';
import { useLocalUser } from '~/hooks/useLocalUser';
import { Topbar } from '~/components/redesign/Topbar';
import {
  Breadcrumb,
  Card,
  Chip,
  Display,
  Eyebrow,
  Progress,
  Rule,
} from '~/components/redesign/ui';
import { I } from '~/components/redesign/icons';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  await requireClientUser('STUDENT');
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

export default function StudentCourseModules({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { user, logout } = useLocalUser();
  const { course, modules } = loaderData;
  const moduleList = modules ?? [];
  const meta = course.externalMetadata ?? null;
  const code = (meta?.code as string | undefined) || `COURSE ${course.id}`;
  const term = (meta?.term as string | undefined) || 'Spring 2026';
  const description = course.description || (meta?.description as string | undefined) || '';

  const overall = (() => {
    if (!course.progress || course.progress.total === 0) return 0;
    return course.progress.completed / course.progress.total;
  })();
  const publishedCount = moduleList.filter((m) => m.isPublished).length;

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      <Topbar role={user.role} page="student" user={user} onLogout={logout} />

      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Breadcrumb
          items={[
            { label: 'My Courses', onClick: () => navigate('/student') },
            { label: code },
          ]}
        />

        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gap: 48,
            alignItems: 'start',
          }}
        >
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Chip tone="ember">{code}</Chip>
              <Chip tone="outline">{term}</Chip>
            </div>
            <Display size={52}>{course.title}</Display>
            {description && (
              <p
                style={{
                  color: 'var(--ink-3)',
                  fontSize: 16,
                  marginTop: 12,
                  maxWidth: 680,
                  lineHeight: 1.55,
                }}
              >
                {description}
              </p>
            )}
          </div>
          <Card style={{ padding: 20 }}>
            <Eyebrow>Your progress</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
              <div style={{ fontFamily: 'var(--rd-font-display)', fontSize: 56, lineHeight: 1 }}>
                {Math.round(overall * 100)}
              </div>
              <div style={{ color: 'var(--ink-3)', fontFamily: 'var(--rd-font-mono)' }}>
                % complete
              </div>
            </div>
            <Progress value={overall} tone="ember" />
            <Rule style={{ margin: '16px 0' }} />
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-3)' }}>Modules</span>
                <b>
                  {publishedCount} / {moduleList.length}
                </b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-3)' }}>Activities</span>
                <b>
                  {course.progress?.completed ?? 0} / {course.progress?.total ?? 0}
                </b>
              </div>
            </div>
          </Card>
        </div>

        <Rule style={{ margin: '40px 0 24px' }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <Display size={28}>Modules</Display>
          <Eyebrow>{publishedCount} published</Eyebrow>
        </div>

        {moduleList.length === 0 ? (
          <Card style={{ padding: 32, textAlign: 'center' }}>
            <Display size={22}>No modules yet.</Display>
            <p style={{ color: 'var(--ink-3)', marginTop: 6 }}>Check back later.</p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {moduleList.map((m, i) => (
              <ModuleRow
                key={m.id}
                m={m}
                n={i + 1}
                onOpen={() => navigate(`/student/module/${m.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ModuleRow({ m, n, onOpen }: { m: Module; n: number; onOpen: () => void }) {
  const locked = !m.isPublished;
  const progress =
    m.progress && m.progress.total > 0 ? m.progress.completed / m.progress.total : 0;

  return (
    <Card style={{ padding: 0, opacity: locked ? 0.55 : 1 }}>
      <div
        onClick={() => !locked && onOpen()}
        style={{
          padding: '20px 24px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto auto auto',
          alignItems: 'center',
          gap: 20,
          cursor: locked ? 'default' : 'pointer',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--rd-font-display)',
            fontSize: 32,
            color: 'var(--ink-3)',
            width: 40,
          }}
        >
          {String(n).padStart(2, '0')}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--rd-font-display)', fontSize: 22, lineHeight: 1.2 }}>
            {m.title}
          </div>
          {m.description && (
            <div style={{ color: 'var(--ink-3)', fontSize: 13, marginTop: 4 }}>{m.description}</div>
          )}
        </div>
        <div style={{ width: 180 }}>
          <Progress value={progress} tone="ember" />
          <div
            style={{
              fontFamily: 'var(--rd-font-mono)',
              fontSize: 11,
              color: 'var(--ink-3)',
              marginTop: 6,
              textAlign: 'right',
            }}
          >
            {Math.round(progress * 100)}% · {m.progress?.total ?? 0} activities
          </div>
        </div>
        <div>
          {locked ? (
            <Chip tone="outline">draft</Chip>
          ) : progress === 1 ? (
            <Chip tone="ok">complete</Chip>
          ) : progress > 0 ? (
            <Chip tone="ember">in progress</Chip>
          ) : (
            <Chip tone="outline">not started</Chip>
          )}
        </div>
        <div style={{ color: 'var(--ink-3)' }}>{I.chevR}</div>
      </div>
    </Card>
  );
}
