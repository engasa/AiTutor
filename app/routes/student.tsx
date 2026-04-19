import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Course } from '../lib/types';
import type { Route } from './+types/student';
import api from '~/lib/api';
import { requireClientUser } from '~/lib/client-auth';
import { useLocalUser } from '~/hooks/useLocalUser';
import { Topbar } from '~/components/redesign/Topbar';
import {
  Btn,
  Card,
  Chip,
  Display,
  Eyebrow,
  Progress,
} from '~/components/redesign/ui';
import { I } from '~/components/redesign/icons';
import type { CourseColor } from '~/components/redesign/data';

type Filter = 'all' | 'in-progress' | 'published';

export async function clientLoader(_: Route.ClientLoaderArgs) {
  await requireClientUser('STUDENT');
  const courses = (await api.listCourses()) as Course[];
  return { courses };
}

const COLORS: CourseColor[] = ['ember', 'lapis', 'moss', 'sunset'];

type DisplayCourse = {
  id: number;
  title: string;
  code: string;
  description: string;
  instructor: string;
  term: string;
  enrolled: number;
  progress: number;
  completed: number;
  total: number;
  isPublished: boolean;
  color: CourseColor;
};

function adapt(course: Course, idx: number): DisplayCourse {
  const meta = course.externalMetadata ?? null;
  const code = (meta?.code as string | undefined) || `COURSE ${course.id}`;
  const term = (meta?.term as string | undefined) || 'Spring 2026';
  const description = course.description || (meta?.description as string | undefined) || '';
  const completed = course.progress?.completed ?? 0;
  const total = course.progress?.total ?? 0;
  const progressFrac = total > 0 ? completed / total : 0;
  return {
    id: course.id,
    title: course.title,
    code,
    description,
    instructor: 'Your instructor',
    term,
    enrolled: 0,
    progress: progressFrac,
    completed,
    total,
    isPublished: Boolean(course.isPublished),
    color: COLORS[idx % COLORS.length],
  };
}

export default function StudentHome({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { user, logout } = useLocalUser();
  const allCourses = useMemo(
    () => (loaderData.courses ?? []).map(adapt),
    [loaderData.courses],
  );
  const [filter, setFilter] = useState<Filter>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const courses = useMemo(() => {
    return allCourses.filter((c) => {
      if (filter === 'in-progress' && (c.progress <= 0 || c.progress >= 1)) return false;
      if (filter === 'published' && !c.isPublished) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (
          !c.title.toLowerCase().includes(q) &&
          !c.code.toLowerCase().includes(q) &&
          !c.description.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allCourses, filter, query]);
  const featured = courses[0];

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      <Topbar role={user.role} page="student" user={user} onLogout={logout} />

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '48px 32px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'end',
            gap: 24,
            marginBottom: 40,
          }}
        >
          <div>
            <Eyebrow>Spring term · Week 9 of 13</Eyebrow>
            <Display size={54} style={{ marginTop: 12 }}>
              Good afternoon,{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--ember)' }}>
                {user.name?.split(' ')[0] || 'friend'}
              </em>
              .
            </Display>
            <p
              style={{
                marginTop: 12,
                color: 'var(--ink-3)',
                fontSize: 16,
                maxWidth: 560,
              }}
            >
              {featured ? (
                <>
                  Continue with{' '}
                  <b style={{ color: 'var(--ink-2)' }}>{featured.title}</b> — pick up where you left
                  off.
                </>
              ) : (
                "You're not enrolled in any courses yet. Once a professor adds you, your work will appear here."
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Btn
              variant="ghost"
              icon={I.search}
              onClick={() => {
                setSearchOpen((s) => !s);
                if (searchOpen) setQuery('');
              }}
            >
              {searchOpen ? 'Close search' : 'Find a topic'}
            </Btn>
            {featured && (
              <Btn
                variant="primary"
                icon={I.compass}
                onClick={() => navigate(`/student/courses/${featured.id}`)}
              >
                Resume {featured.title.split(' ').slice(0, 2).join(' ')}
              </Btn>
            )}
          </div>
        </div>

        {searchOpen && (
          <div style={{ marginBottom: 24 }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses, codes, topics…"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--paper-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--rd-radius-sm)',
                fontSize: 15,
                fontFamily: 'var(--rd-font-ui)',
                color: 'var(--ink)',
                outline: 'none',
              }}
            />
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 0,
            border: '1px solid var(--line)',
            borderRadius: 'var(--rd-radius)',
            background: 'var(--paper-2)',
            overflow: 'hidden',
            marginBottom: 40,
          }}
        >
          {[
            {
              k: `${Math.round(
                (courses.reduce((s, c) => s + c.progress, 0) / Math.max(1, courses.length)) * 100,
              )}%`,
              l: 'Overall progress',
              s: `${courses.length} courses`,
            },
            { k: '128', l: 'Activities attempted', s: '94 correct' },
            { k: '3h 40m', l: 'Time with Oliver', s: '41 exchanges' },
            { k: '4.6', l: 'Avg. activity rating', s: 'Algorithms leads' },
          ].map((s, i) => (
            <div
              key={i}
              style={{ padding: '22px 24px', borderLeft: i > 0 ? '1px solid var(--line)' : 'none' }}
            >
              <div
                style={{ fontFamily: 'var(--rd-font-display)', fontSize: 40, lineHeight: 1 }}
              >
                {s.k}
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-2)' }}>{s.l}</div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11.5,
                  color: 'var(--ink-3)',
                  fontFamily: 'var(--rd-font-mono)',
                }}
              >
                {s.s}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Display size={28}>Your courses</Display>
          <div style={{ display: 'flex', gap: 8 }}>
            {(
              [
                { id: 'all', label: 'All', icon: I.filter },
                { id: 'in-progress', label: 'In progress' },
                { id: 'published', label: 'Published' },
              ] as Array<{ id: Filter; label: string; icon?: React.ReactNode }>
            ).map((f) => (
              <Chip
                key={f.id}
                tone={filter === f.id ? 'ink' : 'outline'}
                icon={f.icon}
                onClick={() => setFilter(f.id)}
                style={{ cursor: 'pointer' }}
              >
                {f.label}
              </Chip>
            ))}
          </div>
        </div>

        {courses.length === 0 ? (
          <Card style={{ padding: 40, textAlign: 'center' }}>
            <Display size={28}>No courses yet.</Display>
            <p style={{ marginTop: 8, color: 'var(--ink-3)' }}>
              Ask your instructor to enroll you, or sync from EduAI.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {courses.map((c, idx) => (
              <CourseCard
                key={c.id}
                course={c}
                featured={idx === 0}
                onClick={() => navigate(`/student/courses/${c.id}`)}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

function CourseCard({
  course,
  featured,
  onClick,
}: {
  course: DisplayCourse;
  featured: boolean;
  onClick: () => void;
}) {
  const tone: 'ember' | 'lapis' | 'moss' | 'sunset' = course.color;
  return (
    <Card
      onClick={onClick}
      interactive
      style={{
        padding: 24,
        display: 'grid',
        gridTemplateColumns: featured ? '1fr 280px' : '1fr',
        gap: 24,
        minHeight: featured ? 280 : 200,
        borderColor: featured ? 'var(--ink-2)' : 'var(--line)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <Chip tone={tone} size="sm">
              {course.code}
            </Chip>
            <Chip tone="outline" size="sm">
              {course.term}
            </Chip>
          </div>
          <Display size={featured ? 34 : 24}>{course.title}</Display>
          <p
            style={{
              color: 'var(--ink-3)',
              marginTop: 8,
              fontSize: 13.5,
              lineHeight: 1.55,
            }}
          >
            {course.description}
          </p>
        </div>
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--rd-font-mono)',
                fontSize: 11,
                color: 'var(--ink-3)',
                letterSpacing: '.08em',
              }}
            >
              PROGRESS
            </div>
            <div style={{ fontFamily: 'var(--rd-font-display)', fontSize: 20 }}>
              {Math.round(course.progress * 100)}
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>%</span>
            </div>
          </div>
          <Progress value={course.progress} tone="ember" />
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
              {course.instructor}
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--ink)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Continue {I.arrowR}
            </span>
          </div>
        </div>
      </div>
      {featured && (
        <div
          style={{
            background: 'var(--paper-3)',
            borderRadius: 'var(--rd-radius-sm)',
            padding: 16,
            border: '1px solid var(--line)',
          }}
        >
          <Eyebrow>Up next</Eyebrow>
          <div style={{ fontFamily: 'var(--rd-font-display)', fontSize: 22, marginTop: 6 }}>
            {course.total === 0
              ? 'No activities yet'
              : course.completed >= course.total
                ? 'Course complete'
                : course.completed === 0
                  ? 'Start first lesson'
                  : 'Continue lesson'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
            {course.code} ·{' '}
            {course.total === 0
              ? 'awaiting setup'
              : course.completed >= course.total
                ? 'all done'
                : course.completed > 0
                  ? 'in progress'
                  : 'not started'}
          </div>
          <div
            style={{
              marginTop: 16,
              padding: '12px 0',
              borderTop: '1px solid var(--line)',
              borderBottom: '1px solid var(--line)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--rd-font-mono)',
                  fontSize: 10.5,
                  color: 'var(--ink-3)',
                  letterSpacing: '.08em',
                }}
              >
                COMPLETED
              </div>
              <div
                style={{ fontFamily: 'var(--rd-font-display)', fontSize: 22, marginTop: 2 }}
              >
                {course.completed}
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                  {' '}
                  / {course.total}
                </span>
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--rd-font-mono)',
                  fontSize: 10.5,
                  color: 'var(--ink-3)',
                  letterSpacing: '.08em',
                }}
              >
                ACTIVITIES
              </div>
              <div
                style={{ fontFamily: 'var(--rd-font-display)', fontSize: 22, marginTop: 2 }}
              >
                {course.total}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
