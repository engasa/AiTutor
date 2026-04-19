import type { Route } from './+types/home';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLocalUser } from '../hooks/useLocalUser';
import { signInWithEduAi } from '../lib/auth-client';
import type { Role } from '../lib/types';
import { Btn, Display, Eyebrow } from '~/components/redesign/ui';
import { I } from '~/components/redesign/icons';
import { Logo } from '~/components/redesign/Logo';
import { Oliver } from '~/components/redesign/Mascot';
import { useTweaks } from '~/components/redesign/tweaks';

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'AiTutor — Welcome' },
    { name: 'description', content: 'Sign in to AiTutor with your EduAI account' },
  ];
}

function routeForRole(role: Role) {
  if (role === 'STUDENT') return '/student';
  if (role === 'PROFESSOR') return '/instructor';
  if (role === 'TA') return '/unsupported-role';
  return '/admin';
}

function extractErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Could not start EduAI sign-in';
  try {
    const parsed = JSON.parse(error.message);
    if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message;
    if (typeof parsed?.error === 'string' && parsed.error.trim()) return parsed.error;
  } catch {
    // Fall through to error.message.
  }
  return error.message || 'Could not start EduAI sign-in';
}

export default function Home() {
  const navigate = useNavigate();
  const { user, isInitializing } = useLocalUser();
  const { setOpen: openTweaks, tweaks } = useTweaks();
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
    }
  };

  if (isInitializing || user) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--paper)',
          color: 'var(--ink)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            fontFamily: 'var(--rd-font-mono)',
            fontSize: 12,
            color: 'var(--ink-3)',
            letterSpacing: '.1em',
          }}
        >
          <Logo size={48} />
          <span>INITIALIZING WORKSPACE…</span>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '1.1fr 1fr',
      }}
    >
      <aside
        style={{
          position: 'relative',
          background: 'var(--paper-2)',
          borderRight: '1px solid var(--line)',
          padding: '48px 56px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={32} />
          <span
            style={{
              fontFamily: 'var(--rd-font-display)',
              fontSize: 26,
              fontStyle: 'italic',
            }}
          >
            AiTutor
          </span>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            marginTop: 40,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Eyebrow>Honours Capstone · UBC</Eyebrow>
          <Display size={68} style={{ marginTop: 14, maxWidth: 560 }}>
            Quiet help when you&apos;re
            <br />
            <em style={{ fontStyle: 'italic', color: 'var(--ember)' }}>nearly there.</em>
          </Display>
          <p
            style={{
              fontSize: 17,
              color: 'var(--ink-2)',
              maxWidth: 500,
              marginTop: 20,
              lineHeight: 1.55,
            }}
          >
            A tutor that hints, questions, and nudges — but never hands you the answer. Work through
            your course, and Oliver will meet you where you are.
          </p>

          <div
            style={{
              marginTop: 48,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
              maxWidth: 600,
            }}
          >
            {[
              { k: '01', t: 'Structured', d: 'Modules, lessons and activities built by your professor.' },
              { k: '02', t: 'Socratic', d: 'Three tutoring modes: teach, guide, or a custom coach.' },
              { k: '03', t: 'Supervised', d: 'Every AI response passes a dual-loop answer-leak check.' },
            ].map((f) => (
              <div key={f.k}>
                <div
                  style={{
                    fontFamily: 'var(--rd-font-mono)',
                    fontSize: 11,
                    color: 'var(--ember)',
                    letterSpacing: '.14em',
                  }}
                >
                  {f.k}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--rd-font-display)',
                    fontSize: 22,
                    marginTop: 6,
                    lineHeight: 1.1,
                  }}
                >
                  {f.t}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--ink-3)',
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  {f.d}
                </div>
              </div>
            ))}
          </div>
        </div>

        {tweaks.mascot && (
          <div style={{ position: 'absolute', bottom: -20, right: -10, opacity: 0.95, zIndex: 1 }}>
            <Oliver size={260} />
          </div>
        )}
        <svg
          style={{ position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none' }}
          width="100%"
          height="100%"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M0 0h40v40H0z" fill="none" stroke="var(--ink)" strokeWidth=".5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <div
          style={{
            fontFamily: 'var(--rd-font-mono)',
            fontSize: 11,
            color: 'var(--ink-4)',
            letterSpacing: '.08em',
            position: 'relative',
            zIndex: 2,
          }}
        >
          AITUTOR.OK.UBC.CA — Accessible via UBC VPN
        </div>
      </aside>

      <section
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
          background: 'var(--paper)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Eyebrow>Sign in</Eyebrow>
          <Display size={44} style={{ marginTop: 10 }}>
            Welcome back.
          </Display>
          <p style={{ color: 'var(--ink-3)', marginTop: 10, fontSize: 14.5 }}>
            Your identity is managed by EduAI. You&apos;ll be redirected and returned here.
          </p>

          <div
            style={{
              marginTop: 36,
              padding: '28px',
              background: 'var(--paper-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--rd-radius)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px',
                borderRadius: 10,
                background: 'var(--paper)',
                border: '1px solid var(--line)',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--rd-font-display)',
                  fontSize: 20,
                }}
              >
                E
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>EduAI Identity</div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--ink-3)',
                    fontFamily: 'var(--rd-font-mono)',
                  }}
                >
                  OIDC + PKCE · session cookie
                </div>
              </div>
              <span
                style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)' }}
              />
            </div>

            {error && (
              <div
                style={{
                  marginTop: 16,
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

            <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
              <Btn
                size="lg"
                variant="ember"
                iconRight={I.arrowR}
                disabled={loading}
                onClick={onSignIn}
              >
                {loading ? 'Connecting…' : 'Sign in with EduAI'}
              </Btn>
            </div>

            <div
              style={{
                marginTop: 16,
                fontSize: 11.5,
                color: 'var(--ink-4)',
                fontFamily: 'var(--rd-font-mono)',
                textAlign: 'center',
                letterSpacing: '.04em',
              }}
            >
              SSO · UBC accounts only
            </div>
          </div>

          <p
            style={{
              marginTop: 20,
              fontSize: 12,
              color: 'var(--ink-4)',
              textAlign: 'center',
            }}
          >
            By signing in, you agree to the UBC Student Conduct & EduAI Terms.
          </p>
        </div>
      </section>

      <button
        onClick={() => openTweaks(true)}
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 90,
          background: 'var(--ink)',
          color: 'var(--paper)',
          border: 'none',
          padding: '12px 16px',
          borderRadius: 999,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600,
          boxShadow: 'var(--rd-shadow-2)',
          fontFamily: 'var(--rd-font-ui)',
        }}
      >
        {I.sliders} Tweaks
      </button>
    </main>
  );
}
