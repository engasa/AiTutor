import type { Route } from './+types/home';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import api from '../lib/api';
import { useLocalUser } from '../hooks/useLocalUser';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'AI Tutor - Login' },
    { name: 'description', content: 'Login to AI Tutor learning platform' },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const { saveAuth } = useLocalUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.login(email, password);
      const { user } = response;
      saveAuth({ id: user.id, name: user.name, role: user.role });
      navigate(user.role === 'STUDENT' ? '/student' : '/instructor');
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 dots-pattern" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative container mx-auto px-6 py-12 min-h-dvh flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24">
        {/* Left side - Branding */}
        <div className="flex-1 max-w-lg text-center lg:text-left animate-fade-up">
          {/* Logo mark */}
          <div className="inline-flex items-center justify-center mb-8">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-primary/10" />
              <div className="relative flex flex-col items-center gap-1.5">
                <div className="h-2 w-10 rounded-full bg-primary" />
                <div className="h-2 w-8 rounded-full bg-primary/70" />
                <div className="h-2 w-6 rounded-full bg-primary/40" />
              </div>
            </div>
          </div>
          
          {/* Headline */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
            Learn with an
            <span className="block text-gradient">AI Study Buddy</span>
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-md mx-auto lg:mx-0 mb-8">
            Personalized guidance that adapts to your knowledge level. 
            Get hints, not answers, and truly understand the material.
          </p>
          
          {/* Feature pills */}
          <div className="flex flex-wrap justify-center lg:justify-start gap-3">
            <div className="tag tag-primary">
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Adaptive Learning
            </div>
            <div className="tag tag-accent">
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
              </svg>
              Instructor Curated
            </div>
            <div className="tag">
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              Real-time Feedback
            </div>
          </div>
        </div>

        {/* Right side - Login form */}
        <div className="w-full max-w-md animate-fade-up delay-150">
          <div className="card-editorial p-8 sm:p-10">
            {/* Form header */}
            <div className="text-center mb-8">
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Welcome back
              </h2>
              <p className="text-sm text-muted-foreground">
                Sign in to continue your learning journey
              </p>
            </div>

            <form onSubmit={onLogin} className="space-y-5">
              {/* Email field */}
              <div className="space-y-2">
                <label 
                  htmlFor="email" 
                  className="block text-sm font-medium text-foreground"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <label 
                  htmlFor="password" 
                  className="block text-sm font-medium text-foreground"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive animate-fade-in">
                  <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="btn-primary w-full text-base"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Demo credentials */}
            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground text-center mb-3">
                Demo Accounts
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('student@example.com');
                    setPassword('student123');
                  }}
                  className="group rounded-xl border-2 border-dashed border-border hover:border-primary/50 p-3 text-left transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-foreground">Student</span>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground group-hover:text-foreground/70 transition-colors">
                    student@example.com
                  </p>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setEmail('instructor@example.com');
                    setPassword('instructor123');
                  }}
                  className="group rounded-xl border-2 border-dashed border-border hover:border-primary/50 p-3 text-left transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-foreground">Instructor</span>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground group-hover:text-foreground/70 transition-colors">
                    instructor@example.com
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
