import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { AlertCircle, Bot, Bug, LogOut, Shield, Sparkles } from 'lucide-react';
import { useLocalUser } from '../hooks/useLocalUser';
import { api } from '../lib/api';
import TourButton from './TourButton';
import { BugReportDialog } from './bug-report/BugReportDialog';
import { useBugReport } from './bug-report/useBugReport';
import { cn } from '~/lib/utils';

const NAV_ITEMS = [
  { key: 'student', label: 'Learning', to: '/student', matcher: '/student' },
  { key: 'instructor', label: 'Studio', to: '/instructor', matcher: '/instructor' },
  { key: 'admin', label: 'Control', to: '/admin', matcher: '/admin' },
] as const;

export default function Nav() {
  const [eduAiStatus, setEduAiStatus] = useState<'loading' | 'connected' | 'disconnected'>(
    'loading',
  );
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  const navigate = useNavigate();
  const loc = useLocation();
  const { user, logout } = useLocalUser();
  const { captureScreenshot } = useBugReport();
  const isAdminUser = user?.role === 'ADMIN';
  const canReportBug = user?.role === 'STUDENT' || user?.role === 'PROFESSOR';

  useEffect(() => {
    if (isAdminUser) {
      setEduAiStatus('connected');
      return;
    }

    let mounted = true;
    api
      .listAiModels()
      .then(() => {
        if (mounted) setEduAiStatus('connected');
      })
      .catch(() => {
        if (mounted) setEduAiStatus('disconnected');
      });

    return () => {
      mounted = false;
    };
  }, [isAdminUser]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleOpenBugReport = async () => {
    setCapturingScreenshot(true);
    try {
      await captureScreenshot();
      setBugReportOpen(true);
    } finally {
      setCapturingScreenshot(false);
    }
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.key === 'student') return user?.role === 'STUDENT';
    if (item.key === 'instructor') return user?.role === 'PROFESSOR';
    if (item.key === 'admin') return user?.role === 'ADMIN';
    return false;
  });

  return (
    <>
      <header className="px-2 pt-4 sm:px-4">
        <div className="floating-nav">
          <Link to="/" className="flex items-center gap-3 rounded-full px-2 py-1 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] border border-white/12 bg-white/10 shadow-[0_10px_30px_rgba(255,255,255,0.08)]">
              <Sparkles className="h-5 w-5 text-amber-200" />
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-medium uppercase tracking-[0.24em] text-white/44">
                AI Tutor
              </div>
              <div className="text-sm font-semibold tracking-[-0.03em] text-white">
                Adaptive learning OS
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {visibleNavItems.map((item) => {
              const active = loc.pathname.startsWith(item.matcher);
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  className={cn('nav-pill', active && 'nav-pill-active')}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <StatusBadge status={eduAiStatus} />
            <TourButton />
            {canReportBug ? (
              <button
                type="button"
                onClick={handleOpenBugReport}
                className="nav-pill hidden sm:inline-flex"
                disabled={capturingScreenshot}
              >
                <Bug className="h-4 w-4" />
                {capturingScreenshot ? 'Preparing...' : 'Report Bug'}
              </button>
            ) : null}
            {user ? (
              <div className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-white/74 md:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-sm font-semibold uppercase text-white">
                  {user.name?.charAt(0) || 'U'}
                </div>
                <div className="max-w-[10rem]">
                  <div className="truncate text-sm font-semibold text-white">{user.name}</div>
                  <div className="text-[0.68rem] uppercase tracking-[0.24em] text-white/42">
                    {user.role}
                  </div>
                </div>
              </div>
            ) : null}
            <button type="button" onClick={handleLogout} className="nav-pill" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <BugReportDialog open={bugReportOpen} setOpen={setBugReportOpen} />
    </>
  );
}

function StatusBadge({ status }: { status: 'loading' | 'connected' | 'disconnected' }) {
  const copy =
    status === 'loading'
      ? { label: 'Syncing', icon: <Bot className="h-4 w-4" />, tone: 'text-white/62' }
      : status === 'connected'
        ? { label: 'EduAI ready', icon: <Shield className="h-4 w-4" />, tone: 'text-emerald-200' }
        : { label: 'Check link', icon: <AlertCircle className="h-4 w-4" />, tone: 'text-rose-200' };

  return (
    <div className={cn('nav-pill hidden sm:inline-flex', copy.tone)}>
      {copy.icon}
      {copy.label}
    </div>
  );
}
