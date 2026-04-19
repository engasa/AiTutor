import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight,
  Bot,
  ChartColumnIncreasing,
  Compass,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  AppBackdrop,
  AppContainer,
  DashboardCard,
  SectionEyebrow,
  StatPill,
} from '~/components/AppShell';
import { useLocalUser } from '../hooks/useLocalUser';
import { signInWithEduAi } from '../lib/auth-client';
import type { Role } from '../lib/types';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function meta() {
  return [
    { title: 'AI Tutor' },
    {
      name: 'description',
      content: 'A redesigned AI-native learning environment for students, instructors, and admins.',
    },
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
    return error.message || 'Could not start EduAI sign-in';
  }

  return error.message || 'Could not start EduAI sign-in';
}

export default function Home() {
  const navigate = useNavigate();
  const { user, isInitializing } = useLocalUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const heroRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLParagraphElement>(null);

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

  useGSAP(
    () => {
      if (!heroRef.current || !galleryRef.current || !revealRef.current) return;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      gsap.fromTo(
        heroRef.current.querySelectorAll('[data-hero-item]'),
        { opacity: 0, y: 32 },
        { opacity: 1, y: 0, duration: 1, stagger: 0.12, ease: 'power3.out' },
      );

      if (prefersReducedMotion) {
        gsap.set(galleryRef.current.querySelectorAll('[data-stack-card]'), {
          opacity: 1,
          scale: 1,
          y: 0,
        });
        gsap.set(revealRef.current.querySelectorAll('span'), { opacity: 1 });
        return;
      }

      const cards = galleryRef.current.querySelectorAll('[data-stack-card]');
      cards.forEach((card, index) => {
        gsap.fromTo(
          card,
          { opacity: 0.35, scale: 0.94, y: 48 },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top bottom-=60',
              end: 'top center',
              toggleActions: 'play none none reverse',
            },
          },
        );
        if (index > 0) {
          gsap.to(card, {
            y: -index * 6,
            scrollTrigger: {
              trigger: card,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.5,
            },
          });
        }
      });

      const words = revealRef.current.querySelectorAll('span');
      gsap.to(words, {
        opacity: 1,
        stagger: 0.08,
        ease: 'none',
        scrollTrigger: {
          trigger: revealRef.current,
          start: 'top 78%',
          end: 'bottom 45%',
          scrub: 0.6,
        },
      });
    },
    { scope: heroRef },
  );

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
      <main className="app-shell flex min-h-dvh items-center justify-center">
        <AppBackdrop pattern="radial" />
        <div className="panel-glass px-8 py-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-white/8">
            <Bot className="h-7 w-7 animate-pulse-soft text-amber-200" />
          </div>
          <div className="text-lg font-semibold text-white">Initializing your workspace</div>
          <div className="mt-2 text-sm text-white/58">Routing you into the right environment.</div>
        </div>
      </main>
    );
  }

  const revealText =
    'Students move with clarity. Instructors compose better learning paths. Admins govern model policy and platform health without fighting the interface.';

  return (
    <main className="app-shell w-full max-w-full overflow-x-hidden text-white">
      <AppBackdrop />

      <section className="px-3 pt-4 sm:px-4">
        <div className="floating-nav">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] border border-white/12 bg-white/10">
              <Sparkles className="h-5 w-5 text-amber-200" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/42">AI Tutor</div>
              <div className="text-sm font-semibold tracking-[-0.03em] text-white">
                Learning built like a product, not a portal
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <a href="#interest" className="nav-pill">
              Experience
            </a>
            <a href="#desire" className="nav-pill">
              Motion
            </a>
            <a href="#action" className="nav-pill">
              Access
            </a>
          </div>
          <button type="button" onClick={onSignIn} disabled={loading} className="btn-primary">
            {loading ? 'Connecting…' : 'Sign in with EduAI'}
          </button>
        </div>
      </section>

      <AppContainer className="py-10 sm:py-14 lg:py-16">
        <section
          ref={heroRef}
          className="relative overflow-hidden rounded-[2.6rem] border border-white/10 bg-black/25 px-6 py-10 shadow-[0_30px_90px_rgba(3,7,18,0.4)] backdrop-blur-2xl sm:px-8 sm:py-14 lg:px-12 lg:py-18"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_28%),url('https://picsum.photos/seed/ai-cinematic-campus/1920/1080')] bg-cover bg-center opacity-35 mix-blend-luminosity" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(8,10,21,0.12),rgba(8,10,21,0.88)_68%)]" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <SectionEyebrow tone="warm">
              <span data-hero-item>Adaptive learning</span>
            </SectionEyebrow>
            <h1
              data-hero-item
              className="mt-6 max-w-6xl text-balance text-[clamp(3.2rem,8vw,7rem)] font-semibold leading-[0.93] tracking-[-0.07em] text-white"
            >
              Every course becomes
              <span
                aria-hidden
                className="inline-photo"
                style={{
                  backgroundImage: 'url(https://picsum.photos/seed/mentored-learning/320/180)',
                }}
              />
              a guided studio for thinking,
              <span
                aria-hidden
                className="inline-photo"
                style={{
                  backgroundImage: 'url(https://picsum.photos/seed/knowledge-map/320/180)',
                }}
              />
              feedback, and momentum.
            </h1>
            <p
              data-hero-item
              className="mt-8 max-w-3xl text-pretty text-lg leading-8 text-white/70 sm:text-xl"
            >
              AI Tutor is now rebuilt as a cinematic learning system: sharper navigation, clearer
              hierarchy, better pacing, and a premium workspace for students, instructors, and
              admins.
            </p>
            <div data-hero-item className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={onSignIn} disabled={loading} className="btn-primary">
                {loading ? 'Connecting…' : 'Enter with EduAI'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#interest" className="btn-secondary">
                Explore the redesign
              </a>
            </div>
            {error ? (
              <div
                data-hero-item
                className="mt-6 rounded-full border border-rose-300/20 bg-rose-300/10 px-4 py-2 text-sm text-rose-100"
              >
                {error}
              </div>
            ) : null}
          </div>
        </section>
      </AppContainer>

      <AppContainer id="interest" className="py-24 md:py-32">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:grid-rows-2 lg:grid-flow-dense">
          <DashboardCard className="lg:col-span-7 lg:row-span-2">
            <SectionEyebrow tone="cool">Attention into structure</SectionEyebrow>
            <div className="mt-6 max-w-2xl">
              <h2 className="text-balance text-[clamp(2rem,4vw,4rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-white">
                A denser information rhythm without the old dashboard clutter.
              </h2>
              <p className="mt-4 text-lg leading-8 text-white/68">
                Course progress, publishing state, AI guidance, and admin control surfaces now feel
                like one system instead of separate screens.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <StatPill label="Student view" value="Course flow first" />
              <StatPill label="Instructor view" value="Authoring as studio" />
              <StatPill label="Admin view" value="Policy with context" />
            </div>
          </DashboardCard>

          <DashboardCard className="lg:col-span-5">
            <Compass className="h-8 w-8 text-cyan-200" />
            <h3 className="dashboard-card-title mt-6">Navigation becomes directional</h3>
            <p className="dashboard-card-copy mt-3">
              Floating glass navigation, tighter identity cues, and role-aware links keep users
              oriented without wasting vertical space.
            </p>
          </DashboardCard>

          <DashboardCard className="lg:col-span-3">
            <ChartColumnIncreasing className="h-8 w-8 text-amber-200" />
            <h3 className="dashboard-card-title mt-6">Progress reads faster</h3>
            <p className="dashboard-card-copy mt-3">
              Cards lead with status, hierarchy, and next actions rather than generic labels.
            </p>
          </DashboardCard>

          <DashboardCard className="lg:col-span-2">
            <ShieldCheck className="h-8 w-8 text-emerald-200" />
            <h3 className="dashboard-card-title mt-6">Governance stays visible</h3>
            <p className="dashboard-card-copy mt-3">
              Admin policy controls no longer feel bolted on.
            </p>
          </DashboardCard>
        </div>
      </AppContainer>

      <AppContainer id="desire" className="py-24 md:py-36">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="self-start lg:sticky lg:top-32">
            <SectionEyebrow tone="warm">Scroll choreography</SectionEyebrow>
            <h2 className="mt-6 max-w-xl text-balance text-[clamp(2.2rem,4vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-white">
              The product now earns attention as you move through it.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-8 text-white/68">
              Pinned narrative on the left. Stacked product chapters on the right. The motion is
              subtle enough for a tool, but strong enough to reset how the platform feels.
            </p>
          </div>

          <div ref={galleryRef} className="space-y-5">
            {[
              {
                title: 'Student dashboard',
                copy: 'Course cards become guided entry points with stronger hierarchy and calmer progress framing.',
                image: 'https://picsum.photos/seed/student-dashboard/960/720',
              },
              {
                title: 'Instructor studio',
                copy: 'Import, publishing, and lesson editing now sit inside a stronger editorial shell.',
                image: 'https://picsum.photos/seed/instructor-studio/960/720',
              },
              {
                title: 'Admin command surface',
                copy: 'Settings and triage panels inherit the same premium language instead of looking like exceptions.',
                image: 'https://picsum.photos/seed/admin-console/960/720',
              },
            ].map((item) => (
              <DashboardCard
                key={item.title}
                interactive
                className="group overflow-hidden p-0"
                data-stack-card
              >
                <div className="overflow-hidden">
                  <div
                    className="h-72 w-full bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(12,16,31,0.08), rgba(12,16,31,0.78)), url(${item.image})`,
                    }}
                  />
                </div>
                <div className="p-6">
                  <h3 className="dashboard-card-title">{item.title}</h3>
                  <p className="dashboard-card-copy mt-3">{item.copy}</p>
                </div>
              </DashboardCard>
            ))}
          </div>
        </div>
      </AppContainer>

      <AppContainer className="py-24 md:py-36">
        <DashboardCard className="px-6 py-8 sm:px-10 sm:py-12">
          <SectionEyebrow tone="cool">Clarity in motion</SectionEyebrow>
          <p
            ref={revealRef}
            className="mt-8 max-w-5xl text-balance text-[clamp(1.6rem,3vw,3.1rem)] leading-[1.18] tracking-[-0.05em] text-white/95"
          >
            {revealText.split(' ').map((word, index) => (
              <span key={`${word}-${index}`} className="motion-word mr-[0.35em] inline-block">
                {word}
              </span>
            ))}
          </p>
        </DashboardCard>
      </AppContainer>

      <AppContainer id="action" className="pb-16 pt-24 md:pb-24 md:pt-32">
        <section className="rounded-[2.6rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,209,102,0.15),rgba(255,255,255,0.05),rgba(97,196,255,0.12))] px-6 py-10 shadow-[0_30px_90px_rgba(3,7,18,0.35)] sm:px-8 sm:py-14 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)] lg:items-end">
            <div>
              <SectionEyebrow tone="warm">Action</SectionEyebrow>
              <h2 className="mt-6 max-w-3xl text-balance text-[clamp(2.2rem,4vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-slate-950">
                Sign in and step into the redesigned workspace.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-900/72">
                The app’s UI has been rethought from first principles: more cinematic, more legible,
                and better aligned to the actual learning workflows inside it.
              </p>
            </div>
            <div className="panel-glass p-6">
              <div className="text-sm uppercase tracking-[0.22em] text-white/46">Access</div>
              <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                EduAI single sign-on
              </div>
              <button
                type="button"
                onClick={onSignIn}
                disabled={loading}
                className="btn-primary mt-6 w-full"
              >
                {loading ? 'Connecting…' : 'Continue with EduAI'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </AppContainer>

      <footer className="pb-10 text-center text-sm text-white/40">
        AI Tutor redesign: premium UI system for learning, authoring, and governance.
      </footer>
    </main>
  );
}
