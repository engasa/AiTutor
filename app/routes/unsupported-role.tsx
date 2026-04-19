import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { AppBackdrop, AppContainer, DashboardCard, SectionEyebrow } from '~/components/AppShell';
import { useLocalUser } from '../hooks/useLocalUser';

function routeForRole(role: string) {
  if (role === 'STUDENT') return '/student';
  if (role === 'PROFESSOR') return '/instructor';
  if (role === 'ADMIN') return '/admin';
  return '/';
}

export default function UnsupportedRolePage() {
  const navigate = useNavigate();
  const { user, logout } = useLocalUser();

  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true });
      return;
    }
    if (user.role !== 'TA') {
      navigate(routeForRole(user.role), { replace: true });
    }
  }, [navigate, user]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <main className="app-shell">
      <AppBackdrop pattern="radial" />
      <AppContainer className="flex min-h-dvh items-center justify-center py-16">
        <DashboardCard className="max-w-3xl p-8 sm:p-10">
          <SectionEyebrow tone="warm">Role mismatch</SectionEyebrow>
          <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-amber-300/18 bg-amber-300/12">
            <ShieldAlert className="h-8 w-8 text-amber-100" />
          </div>
          <h1 className="mt-6 text-balance text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-white">
            TA access is authenticated, but not supported in this release.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/62">
            Your EduAI account signed in correctly. AI Tutor just does not expose a TA workspace
            yet. If your role should be different, update it in EduAI and sign in again.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={handleLogout} className="btn-primary">
              Sign out
            </button>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="btn-secondary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </button>
          </div>
        </DashboardCard>
      </AppContainer>
    </main>
  );
}
