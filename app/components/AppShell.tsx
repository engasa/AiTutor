import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '~/lib/utils';

export function AppBackdrop({ pattern = 'mesh' }: { pattern?: 'mesh' | 'grid' | 'radial' }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="app-noise absolute inset-0" />
      <div className="app-gradient absolute inset-0" />
      <div className="app-glow app-glow-one absolute left-[-12rem] top-[-12rem] h-[30rem] w-[30rem] rounded-full blur-3xl" />
      <div className="app-glow app-glow-two absolute right-[-14rem] top-[12rem] h-[34rem] w-[34rem] rounded-full blur-3xl" />
      <div className="app-glow app-glow-three absolute bottom-[-16rem] left-[12%] h-[32rem] w-[32rem] rounded-full blur-3xl" />
      <div className={cn('absolute inset-0 opacity-50', pattern === 'grid' && 'app-grid')} />
      <div className={cn('absolute inset-0 opacity-30', pattern === 'mesh' && 'app-mesh')} />
      <div className={cn('absolute inset-0 opacity-60', pattern === 'radial' && 'app-radial')} />
    </div>
  );
}

export function AppContainer({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('mx-auto w-full max-w-[92rem] px-4 sm:px-6 lg:px-10', className)} {...props}>
      {children}
    </div>
  );
}

export function SectionEyebrow({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'warm' | 'cool';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em]',
        tone === 'default' && 'border-white/12 bg-white/6 text-white/64',
        tone === 'warm' && 'border-amber-300/20 bg-amber-300/10 text-amber-100',
        tone === 'cool' && 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
      )}
    >
      {children}
    </span>
  );
}

export function DashboardHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] p-6 shadow-[0_20px_80px_rgba(5,8,20,0.35)] backdrop-blur-xl sm:p-8 lg:p-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,196,92,0.18),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(82,196,255,0.16),transparent_28%)]" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(22rem,0.95fr)] lg:items-end">
        <div className="space-y-5">
          {eyebrow}
          <div className="max-w-4xl space-y-4">
            <h1 className="text-balance text-[clamp(2.3rem,5vw,5rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-white">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-pretty text-base leading-7 text-white/70 sm:text-lg">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="relative">{aside}</div> : null}
      </div>
    </section>
  );
}

export function DashboardGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3', className)}>
      {children}
    </div>
  );
}

export function DashboardCard({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/6 p-5 shadow-[0_16px_50px_rgba(3,7,18,0.24)] backdrop-blur-xl',
        interactive &&
          'transition-transform duration-500 ease-out hover:-translate-y-1 hover:bg-white/[0.08]',
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_30%)] opacity-70" />
      <div className="relative">{children}</div>
    </div>
  );
}

export function StatPill({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[1.2rem] border border-white/10 bg-black/15 px-4 py-3">
      <div className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-white/48">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">{value}</div>
    </div>
  );
}
