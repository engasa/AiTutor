import type { CSSProperties, ReactNode, MouseEventHandler } from 'react';
import { Fragment } from 'react';

type BtnVariant = 'primary' | 'ember' | 'ghost' | 'tonal' | 'quiet' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg';

type BtnProps = {
  children?: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
};

const btnSizes: Record<BtnSize, CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 12.5 },
  md: { padding: '9px 16px', fontSize: 13.5 },
  lg: { padding: '12px 20px', fontSize: 14.5 },
};

const btnVariants: Record<BtnVariant, CSSProperties> = {
  primary: { background: 'var(--ink)', color: 'var(--paper)', border: '1px solid var(--ink)' },
  ember: { background: 'var(--ember)', color: '#fff', border: '1px solid var(--ember)' },
  ghost: { background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)' },
  tonal: { background: 'var(--paper-2)', color: 'var(--ink)', border: '1px solid var(--line)' },
  quiet: { background: 'transparent', color: 'var(--ink-3)', border: '1px solid transparent' },
  danger: { background: 'transparent', color: 'var(--bad)', border: '1px solid var(--line)' },
};

export const Btn = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  onClick,
  disabled,
  className = '',
  style,
  type = 'button',
  title,
}: BtnProps) => {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 600,
    borderRadius: 999,
    transition: 'all .15s ease',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--rd-font-ui)',
    letterSpacing: '-.01em',
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.5 : 1,
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      title={title}
      style={{ ...base, ...btnSizes[size], ...btnVariants[variant], ...style }}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
};

type ChipTone = 'neutral' | 'ember' | 'moss' | 'lapis' | 'sunset' | 'ok' | 'bad' | 'outline' | 'ink';
type ChipSize = 'sm' | 'md' | 'lg';

const chipTones: Record<ChipTone, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: 'var(--paper-2)', fg: 'var(--ink-2)', bd: 'var(--line)' },
  ember: { bg: 'var(--ember-soft)', fg: 'var(--ember)', bd: 'transparent' },
  moss: { bg: 'rgba(83,107,58,.12)', fg: 'var(--moss)', bd: 'transparent' },
  lapis: { bg: 'rgba(47,74,122,.10)', fg: 'var(--lapis)', bd: 'transparent' },
  sunset: { bg: 'rgba(217,164,65,.14)', fg: '#8a6513', bd: 'transparent' },
  ok: { bg: 'rgba(62,122,79,.12)', fg: 'var(--ok)', bd: 'transparent' },
  bad: { bg: 'rgba(177,66,42,.10)', fg: 'var(--bad)', bd: 'transparent' },
  outline: { bg: 'transparent', fg: 'var(--ink-3)', bd: 'var(--line)' },
  ink: { bg: 'var(--ink)', fg: 'var(--paper)', bd: 'var(--ink)' },
};

const chipSizes: Record<ChipSize, CSSProperties> = {
  sm: { padding: '2px 8px', fontSize: 11 },
  md: { padding: '3px 10px', fontSize: 12 },
  lg: { padding: '5px 12px', fontSize: 12.5 },
};

export const Chip = ({
  children,
  tone = 'neutral',
  size = 'md',
  icon,
  style,
  onClick,
}: {
  children?: ReactNode;
  tone?: ChipTone;
  size?: ChipSize;
  icon?: ReactNode;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLElement>;
}) => {
  const t = chipTones[tone];
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    background: t.bg,
    color: t.fg,
    border: `1px solid ${t.bd}`,
    fontFamily: 'var(--rd-font-mono)',
    fontWeight: 500,
    ...chipSizes[size],
    ...style,
  };
  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={{ ...baseStyle, cursor: 'pointer' }}>
        {icon}
        {children}
      </button>
    );
  }
  return (
    <span style={baseStyle}>
      {icon}
      {children}
    </span>
  );
};

export const Card = ({
  children,
  style,
  onClick,
  interactive = false,
}: {
  children?: ReactNode;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
  interactive?: boolean;
}) => (
  <div
    onClick={onClick}
    style={{
      background: 'var(--paper-2)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--rd-radius)',
      boxShadow: 'var(--rd-shadow-1)',
      cursor: onClick || interactive ? 'pointer' : 'default',
      transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Progress = ({
  value,
  size = 'md',
  tone = 'ink',
}: {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'ink' | 'ember';
}) => {
  const h = size === 'sm' ? 4 : size === 'lg' ? 8 : 6;
  const fill = tone === 'ember' ? 'var(--ember)' : 'var(--ink)';
  return (
    <div
      style={{
        height: h,
        background: 'var(--paper-3)',
        borderRadius: 999,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          background: fill,
          transition: 'width .4s ease',
        }}
      />
    </div>
  );
};

export const Placeholder = ({
  label,
  w = '100%',
  h = 140,
  tone = 'paper-3',
}: {
  label: string;
  w?: number | string;
  h?: number | string;
  tone?: 'paper-2' | 'paper-3';
}) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: 'var(--rd-radius-sm)',
      background: `repeating-linear-gradient(135deg, var(--${tone}) 0 8px, var(--paper-2) 8px 16px)`,
      border: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--rd-font-mono)',
      fontSize: 11,
      color: 'var(--ink-3)',
      letterSpacing: '.02em',
    }}
  >
    {label}
  </div>
);

export const Eyebrow = ({ children, color }: { children?: ReactNode; color?: string }) => (
  <div
    style={{
      fontFamily: 'var(--rd-font-mono)',
      fontSize: 11,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: color || 'var(--ink-3)',
      fontWeight: 600,
    }}
  >
    {children}
  </div>
);

export const Display = ({
  children,
  size = 40,
  style,
}: {
  children?: ReactNode;
  size?: number;
  style?: CSSProperties;
}) => (
  <h1
    style={{
      fontFamily: 'var(--rd-font-display)',
      fontSize: size,
      lineHeight: 1.05,
      margin: 0,
      fontWeight: 400,
      letterSpacing: '-.01em',
      color: 'var(--ink)',
      ...style,
    }}
  >
    {children}
  </h1>
);

export const Rule = ({ style }: { style?: CSSProperties }) => (
  <div style={{ height: 1, background: 'var(--line)', ...style }} />
);

export type CrumbItem = { label: ReactNode; onClick?: () => void };

export const Breadcrumb = ({ items }: { items: CrumbItem[] }) => (
  <nav
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      fontFamily: 'var(--rd-font-mono)',
      fontSize: 12,
      color: 'var(--ink-3)',
    }}
  >
    {items.map((it, i) => (
      <Fragment key={i}>
        {i > 0 && <span style={{ color: 'var(--ink-4)' }}>/</span>}
        <a
          onClick={it.onClick}
          style={{
            cursor: it.onClick ? 'pointer' : 'default',
            color: i === items.length - 1 ? 'var(--ink)' : 'var(--ink-3)',
            textDecoration: 'none',
            fontWeight: i === items.length - 1 ? 600 : 500,
          }}
        >
          {it.label}
        </a>
      </Fragment>
    ))}
  </nav>
);

export const EduAIStatus = ({ connected = true }: { connected?: boolean }) => (
  <div
    className="topbar-eduai"
    title={connected ? 'Connected to EduAI' : 'Disconnected'}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      fontFamily: 'var(--rd-font-mono)',
      fontSize: 11.5,
      color: 'var(--ink-3)',
    }}
  >
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: connected ? 'var(--ok)' : 'var(--bad)',
        boxShadow: connected
          ? '0 0 0 4px rgba(62,122,79,.15)'
          : '0 0 0 4px rgba(177,66,42,.15)',
      }}
    />
    EduAI
  </div>
);

export const Toggle = ({
  on,
  onChange,
}: {
  on: boolean;
  onChange?: (next: boolean) => void;
}) => (
  <button
    type="button"
    onClick={() => onChange?.(!on)}
    style={{
      width: 36,
      height: 22,
      borderRadius: 999,
      background: on ? 'var(--ink)' : 'var(--paper-3)',
      border: '1px solid ' + (on ? 'var(--ink)' : 'var(--line-2)'),
      position: 'relative',
      cursor: 'pointer',
      transition: 'all .15s',
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: 2,
        left: on ? 16 : 2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: 'var(--paper)',
        boxShadow: '0 1px 2px rgba(0,0,0,.15)',
        transition: 'left .15s',
      }}
    />
  </button>
);
