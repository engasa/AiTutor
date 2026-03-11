import type { Route } from './+types/home';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLocalUser } from '../hooks/useLocalUser';
import { signInWithEduAi } from '../lib/auth-client';
import type { Role } from '../lib/types';

export function meta({}: Route.MetaArgs) {
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
  const { user } = useLocalUser();
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

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div className="absolute inset-0 dots-pattern" />
      <div className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-accent/10 blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="relative container mx-auto flex min-h-dvh flex-col items-center justify-center gap-12 px-6 py-12 lg:flex-row lg:gap-24">
        <div className="animate-fade-up flex-1 max-w-lg text-center lg:text-left">
          <div className="mb-8 inline-flex items-center justify-center">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-primary/10" />
              <div className="relative flex flex-col items-center gap-1.5">
                <div className="h-2 w-10 rounded-full bg-primary" />
                <div className="h-2 w-8 rounded-full bg-primary/70" />
                <div className="h-2 w-6 rounded-full bg-primary/40" />
              </div>
            </div>
          </div>

          <h1 className="mb-6 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Learn with an
            <span className="block text-gradient">AI Study Buddy</span>
          </h1>

          <p className="mx-auto mb-8 max-w-md text-lg text-muted-foreground lg:mx-0">
            Personalized guidance that adapts to your knowledge level. Get hints, not answers, and
            truly understand the material.
          </p>

          <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
            <div className="tag tag-primary">Adaptive Learning</div>
            <div className="tag tag-accent">Instructor Curated</div>
            <div className="tag">Real-time Feedback</div>
          </div>
        </div>

        <div className="animate-fade-up delay-150 w-full max-w-md">
          <div className="card-editorial p-8 sm:p-10">
            <div className="mb-8 text-center">
              <h2 className="mb-2 font-display text-2xl font-bold text-foreground">Sign in with EduAI</h2>
              <p className="text-sm text-muted-foreground">
                AI Tutor now uses your EduAI identity. Use the same account you already use across
                the EduAI platform.
              </p>
            </div>

            <div className="space-y-5">
              {error && (
                <div className="animate-fade-in flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              <button type="button" onClick={onSignIn} disabled={loading} className="btn-primary w-full text-base">
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Redirecting to EduAI...
                  </>
                ) : (
                  <>
                    Sign in with EduAI
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>

              <div className="rounded-xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
                New accounts and role changes are managed in EduAI. After sign-in, AI Tutor will
                load your local profile from <code>/api/me</code>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
