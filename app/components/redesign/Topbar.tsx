import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { I } from './icons';
import { Logo } from './Logo';
import { EduAIStatus } from './ui';
import { useTweaks } from './tweaks';
import type { AuthUser } from '~/hooks/useLocalUser';
import { useBugReport } from '~/components/bug-report/useBugReport';
import { BugReportDialog } from '~/components/bug-report/BugReportDialog';
import { useAppTour } from '~/components/TourProvider';

type TopbarRole = 'STUDENT' | 'PROFESSOR' | 'ADMIN' | 'TA' | string;

const ROLE_LINKS: Record<string, { id: string; label: string; icon: React.ReactNode; href: string }[]> = {
  STUDENT: [{ id: 'student', label: 'My Courses', icon: I.book, href: '/student' }],
  PROFESSOR: [{ id: 'instructor', label: 'Teaching', icon: I.layers, href: '/instructor' }],
  ADMIN: [{ id: 'admin', label: 'Console', icon: I.settings, href: '/admin' }],
};

export function Topbar({
  role,
  page,
  user,
  onLogout,
}: {
  role: TopbarRole;
  page: 'student' | 'instructor' | 'admin' | string;
  user: AuthUser;
  onLogout: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setOpen } = useTweaks();
  const { captureScreenshot } = useBugReport();
  const { isRunning, startSuggestedTour, stopTour } = useAppTour();
  const [bugOpen, setBugOpen] = useState(false);
  const [bugBusy, setBugBusy] = useState(false);
  const canReportBug = role === 'STUDENT' || role === 'PROFESSOR';
  const isStudent = location.pathname.startsWith('/student');
  const links = ROLE_LINKS[role] || [];

  const handleLogout = async () => {
    await onLogout();
    navigate('/', { replace: true });
  };

  const handleOpenBug = async () => {
    setBugBusy(true);
    try {
      await captureScreenshot();
      setBugOpen(true);
    } finally {
      setBugBusy(false);
    }
  };

  const handleTour = () => {
    if (isRunning) stopTour();
    else startSuggestedTour();
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'color-mix(in srgb, var(--paper) 88%, transparent)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div
        className="topbar-inner"
        style={{
          maxWidth: 1440,
          margin: '0 auto',
          padding: '14px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <a
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <Logo size={28} />
          <span
            style={{
              fontFamily: 'var(--rd-font-display)',
              fontSize: 22,
              fontStyle: 'italic',
              letterSpacing: '-.01em',
            }}
          >
            AiTutor
          </span>
        </a>
        <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
          {links.map((l) => (
            <a
              key={l.id}
              onClick={() => navigate(l.href)}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                padding: '8px 14px',
                borderRadius: 999,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: page.startsWith(l.id) ? 'var(--ink)' : 'transparent',
                color: page.startsWith(l.id) ? 'var(--paper)' : 'var(--ink-2)',
              }}
            >
              {l.icon} <span className="topbar-nav-label">{l.label}</span>
            </a>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <EduAIStatus />
          {isStudent && (
            <button
              className="topbar-iconbtn"
              onClick={handleTour}
              title={isRunning ? 'Stop tour' : 'Take a guided tour'}
              style={{
                background: isRunning ? 'var(--ember-soft)' : 'transparent',
                border: '1px solid var(--line)',
                padding: '8px 12px',
                borderRadius: 999,
                cursor: 'pointer',
                color: isRunning ? 'var(--ember)' : 'var(--ink-2)',
                fontSize: 12.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {I.lightbulb}
              <span>{isRunning ? 'Stop tour' : 'Take tour'}</span>
            </button>
          )}
          <button
            className="topbar-iconbtn"
            onClick={() => setOpen(true)}
            title="Tweaks"
            style={{
              background: 'transparent',
              border: '1px solid var(--line)',
              padding: 8,
              borderRadius: 10,
              cursor: 'pointer',
              color: 'var(--ink-2)',
            }}
          >
            {I.sliders}
          </button>
          {canReportBug && (
            <button
              className="topbar-iconbtn"
              onClick={handleOpenBug}
              disabled={bugBusy}
              title={bugBusy ? 'Capturing screenshot…' : 'Report a bug'}
              style={{
                background: 'transparent',
                border: '1px solid var(--line)',
                padding: 8,
                borderRadius: 10,
                cursor: bugBusy ? 'wait' : 'pointer',
                color: 'var(--ink-2)',
                opacity: bugBusy ? 0.6 : 1,
              }}
            >
              {I.bug}
            </button>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 4px 4px 12px',
              border: '1px solid var(--line)',
              borderRadius: 999,
            }}
          >
            <div className="topbar-user-text" style={{ whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.1 }}>{user.name}</div>
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--ink-3)',
                  fontFamily: 'var(--rd-font-mono)',
                  letterSpacing: '.08em',
                }}
              >
                {user.role}
              </div>
            </div>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--ink)',
                color: 'var(--paper)',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--rd-font-display)',
                fontSize: 16,
              }}
            >
              {user.name?.[0] || '?'}
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 8,
                cursor: 'pointer',
                color: 'var(--ink-3)',
              }}
            >
              {I.logout}
            </button>
          </div>
        </div>
      </div>
      <BugReportDialog open={bugOpen} setOpen={setBugOpen} />
    </header>
  );
}
