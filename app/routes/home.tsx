import type { Route } from './+types/home';
import { useEffect, useState, cloneElement, type ReactElement, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useLocalUser } from '../hooks/useLocalUser';
import { signInWithEduAi } from '../lib/auth-client';
import type { Role } from '../lib/types';
import {
  BookOpen,
  BrainCircuit,
  GraduationCap,
  LayoutDashboard,
  Library,
  LineChart,
  Sparkles,
  Zap,
} from 'lucide-react';

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'AI Tutor - Welcome' },
    { name: 'description', content: 'Sign in to AI Tutor with your EduAI account' },
  ];
}

function routeForRole(role: Role) {
  if (role === 'STUDENT') return '/student';
  if (role === 'PROFESSOR') return '/instructor';
  if (role === 'TA') return '/unsupported-role';
  return '/admin';
}

function extractErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Could not start EduAI sign-in';
  }

  try {
    const parsed = JSON.parse(error.message);
    if (typeof parsed?.message === 'string' && parsed.message.trim()) {
      return parsed.message;
    }
    if (typeof parsed?.error === 'string' && parsed.error.trim()) {
      return parsed.error;
    }
  } catch {
    // Fall back to the raw message when the backend returns plain text.
  }

  return error.message || 'Could not start EduAI sign-in';
}

export default function Home() {
  const navigate = useNavigate();
  const { user, isInitializing } = useLocalUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    navigate(routeForRole(user.role), { replace: true });
  }, [navigate, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('authError') === 'eduai_sign_in_failed') {
      setError('EduAI sign-in did not complete. Please try again.');
    }
  }, []);

  const onSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      await signInWithEduAi();
    } catch (err) {
      setError(extractErrorMessage(err));
      setLoading(false);
      return;
    } finally {
      // Full-page redirect keeps this from usually running, but it protects the button on failure.
      setLoading(false);
    }
  };

  if (isInitializing || user) {
    return (
      <main className="relative min-h-dvh overflow-hidden bg-background">
        <div className="absolute inset-0 dots-pattern" />
        <div className="relative container mx-auto flex min-h-dvh items-center justify-center px-6 py-12">
          <div className="card-editorial flex w-full max-w-md items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Redirecting to your workspace...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-background text-foreground lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary/5 p-12 lg:flex lg:flex-col lg:justify-between dark:bg-primary/5">
        <div className="absolute inset-0 dots-pattern opacity-30" />
        <div className="absolute left-[-10%] top-[-20%] h-[500px] w-[500px] animate-pulse-soft rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] animate-float rounded-full bg-accent/10 blur-[80px] delay-700" />

        <div className="relative z-10 flex items-center gap-3 animate-fade-down">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">AI Tutor</span>
        </div>

        <div className="animate-fade-up delay-150 w-full max-w-md">
          <div className="card-editorial p-8 sm:p-10">
            <div className="mb-8 text-center">
              <h2 className="mb-2 font-display text-2xl font-bold text-foreground">
                Sign in with EduAI
              </h2>
              <p className="text-sm text-muted-foreground">
                AI Tutor now uses your EduAI identity. Use the same account you already use across
                the EduAI platform.
              </p>
            </div>

            <div className="space-y-5">
              {error && (
                <div className="animate-fade-in flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <svg
                    className="h-4 w-4 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                    />
                  </svg>
                  <p className="min-w-0 flex-1">{error}</p>
                </div>
              )}

              <button
                type="button"
                onClick={onSignIn}
                disabled={loading}
                className="btn-primary w-full text-base"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Redirecting to EduAI...
                  </>
                ) : (
                  <>
                    Sign in with EduAI
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>
                  </>
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-border/50 pt-4 animate-fade-up delay-300">
            <div className="col-span-1">
              <FeatureItem icon={<BrainCircuit />} label="Adaptive" />
            </div>
            <div className="col-span-1">
              <FeatureItem icon={<Library />} label="Structured" />
            </div>
            <div className="col-span-1">
              <FeatureItem icon={<LineChart />} label="Analytics" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function FloatingNode({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex rounded-2xl border border-border bg-card bg-opacity-90 p-3 shadow-lg backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2">
        <div className="text-primary">{icon}</div>
        <span className="whitespace-nowrap text-xs font-semibold">{label}</span>
      </div>
    </div>
  );
}

function FeatureItem({
  icon,
  label,
}: {
  icon: ReactElement<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="group flex cursor-default flex-col items-center gap-2 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        {cloneElement(icon, { className: 'h-5 w-5' })}
      </div>
      <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
        {label}
      </span>
    </div>
  );
}
