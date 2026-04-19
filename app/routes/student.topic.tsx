import { useNavigate } from 'react-router';
import type { Course, Lesson, ModuleDetail } from '../lib/types';
import type { Route } from './+types/student.topic';
import api from '~/lib/api';
import { requireClientUser } from '~/lib/client-auth';
import { useLocalUser } from '~/hooks/useLocalUser';
import { Topbar } from '~/components/redesign/Topbar';
import { Breadcrumb, Card, Chip, Display, Eyebrow, Progress, Rule } from '~/components/redesign/ui';
import { I } from '~/components/redesign/icons';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  await requireClientUser('STUDENT');
  const moduleId = Number(params.moduleId);
  if (!Number.isFinite(moduleId)) {
    throw new Response('Invalid module id', { status: 400 });
  }

  const [module, lessons] = await Promise.all([
    api.moduleById(moduleId) as Promise<ModuleDetail>,
    api.lessonsForModule(moduleId) as Promise<Lesson[]>,
  ]);

  let course: Course | null = null;
  if (module.courseOfferingId) {
    course = (await api.courseById(module.courseOfferingId)) as Course;
  }

  return { course, module, lessons };
}

export default function StudentModuleLessons({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { user, logout } = useLocalUser();
  const { course, module, lessons } = loaderData;
  const lessonList = lessons ?? [];
  const courseCode =
    (course?.externalMetadata?.code as string | undefined) ||
    (course ? `COURSE ${course.id}` : 'Course');

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      <Topbar role={user.role} page="student" user={user} onLogout={logout} />

      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Breadcrumb
          items={[
            { label: 'My Courses', onClick: () => navigate('/student') },
            course
              ? {
                  label: courseCode,
                  onClick: () => navigate(`/student/courses/${module.courseOfferingId}`),
                }
              : { label: 'Course' },
            { label: module?.title || 'Module' },
          ]}
        />

        <div style={{ marginTop: 18 }}>
          <Eyebrow>Module · {courseCode}</Eyebrow>
          <Display size={44} style={{ marginTop: 6 }}>
            {module?.title || 'Module'}
          </Display>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Chip tone="outline">
              {lessonList.length} lessons
            </Chip>
            <Chip tone={module?.isPublished ? 'ok' : 'outline'} icon={module?.isPublished ? I.dot : undefined}>
              {module?.isPublished ? 'published' : 'draft'}
            </Chip>
          </div>
        </div>

        <Rule style={{ margin: '32px 0 22px' }} />

        {lessonList.length === 0 ? (
          <Card style={{ padding: 32, textAlign: 'center' }}>
            <Display size={22}>No lessons yet.</Display>
            <p style={{ color: 'var(--ink-3)', marginTop: 6 }}>Check back later.</p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {lessonList.map((l, i) => (
              <LessonRow
                key={l.id}
                l={l}
                n={i + 1}
                onOpen={() => navigate(`/student/lesson/${l.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LessonRow({ l, n, onOpen }: { l: Lesson; n: number; onOpen: () => void }) {
  const locked = !l.isPublished;
  const progress =
    l.progress && l.progress.total > 0 ? l.progress.completed / l.progress.total : 0;

  return (
    <Card
      onClick={() => !locked && onOpen()}
      interactive={!locked}
      style={{
        padding: '16px 22px',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr 200px auto auto',
        alignItems: 'center',
        gap: 18,
        opacity: locked ? 0.55 : 1,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--rd-font-mono)',
          fontSize: 12,
          color: 'var(--ink-3)',
          width: 28,
        }}
      >
        {String(n).padStart(2, '0')}
      </div>
      <div>
        <div style={{ fontSize: 15.5, fontWeight: 500 }}>{l.title}</div>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--ink-3)',
            fontFamily: 'var(--rd-font-mono)',
            marginTop: 2,
          }}
        >
          {l.progress?.total ?? 0} activities
        </div>
      </div>
      <Progress value={progress} size="sm" tone="ember" />
      {locked ? (
        <Chip tone="outline" size="sm">
          unpublished
        </Chip>
      ) : progress === 1 ? (
        <Chip tone="ok" size="sm">
          complete
        </Chip>
      ) : progress > 0 ? (
        <Chip tone="ember" size="sm">
          in progress
        </Chip>
      ) : (
        <Chip tone="outline" size="sm">
          not started
        </Chip>
      )}
      <div style={{ color: 'var(--ink-3)' }}>{I.chevR}</div>
    </Card>
  );
}
