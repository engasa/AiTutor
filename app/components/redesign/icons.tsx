import type { ReactNode } from 'react';

type IconProps = {
  d: ReactNode;
  size?: number;
  stroke?: number;
  className?: string;
  fill?: string;
};

export const Icon = ({ d, size = 18, stroke = 1.6, className = '', fill = 'none' }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={fill}
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {d}
  </svg>
);

export const I = {
  book: (
    <Icon
      d={
        <>
          <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" />
          <path d="M4 19a2 2 0 0 0 2 2h12" />
        </>
      }
    />
  ),
  chat: <Icon d={<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />} />,
  user: (
    <Icon
      d={
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      }
    />
  ),
  users: (
    <Icon
      d={
        <>
          <circle cx="9" cy="8" r="4" />
          <path d="M2 21a7 7 0 0 1 14 0" />
          <path d="M16 3.5a4 4 0 0 1 0 8" />
          <path d="M22 21a7 7 0 0 0-6-6.9" />
        </>
      }
    />
  ),
  search: (
    <Icon
      d={
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </>
      }
    />
  ),
  plus: <Icon d={<path d="M12 5v14M5 12h14" />} />,
  chevR: <Icon d={<path d="m9 6 6 6-6 6" />} />,
  chevD: <Icon d={<path d="m6 9 6 6 6-6" />} />,
  chevL: <Icon d={<path d="m15 6-6 6 6 6" />} />,
  check: <Icon d={<path d="M5 12l5 5L20 7" />} />,
  x: <Icon d={<path d="M6 6l12 12M18 6 6 18" />} />,
  send: <Icon d={<path d="m3 11 18-8-8 18-2-7z" />} />,
  spark: (
    <Icon d={<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />} />
  ),
  settings: (
    <Icon
      d={
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </>
      }
    />
  ),
  bug: (
    <Icon
      d={
        <>
          <rect x="8" y="5" width="8" height="14" rx="4" />
          <path d="M12 5V3M9 3l1 2M15 3l-1 2M8 10H4M8 14H4M20 10h-4M20 14h-4M8 7 5 5M8 17l-3 2M16 7l3-2M16 17l3 2" />
        </>
      }
    />
  ),
  logout: (
    <Icon
      d={
        <>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
        </>
      }
    />
  ),
  home: (
    <Icon
      d={
        <>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v12h14V9" />
        </>
      }
    />
  ),
  graduate: (
    <Icon
      d={
        <>
          <path d="M2 9 12 4l10 5-10 5z" />
          <path d="M6 11v5a6 6 0 0 0 12 0v-5" />
        </>
      }
    />
  ),
  compass: (
    <Icon
      d={
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m15 9-2 6-6 2 2-6z" />
        </>
      }
    />
  ),
  owl: (
    <Icon
      d={
        <>
          <circle cx="9" cy="10" r="3" />
          <circle cx="15" cy="10" r="3" />
          <path d="M7 4c0 1.5 1 2 2 2M17 4c0 1.5-1 2-2 2M12 13v2M9 17c1 1 2 1.5 3 1.5s2-.5 3-1.5" />
        </>
      }
    />
  ),
  leaf: (
    <Icon
      d={
        <>
          <path d="M11 20A7 7 0 0 1 9.8 6.1L15 3l-1 6a6 6 0 0 1-6 6" />
          <path d="M3 21c2-3 5-5 8-6" />
        </>
      }
    />
  ),
  edit: <Icon d={<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 3 22l1.5-4.5z" />} />,
  trash: (
    <Icon d={<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />} />
  ),
  eye: (
    <Icon
      d={
        <>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      }
    />
  ),
  eyeOff: (
    <Icon
      d={
        <>
          <path d="M2 12s4-7 10-7a10 10 0 0 1 4.7 1.2M22 12s-4 7-10 7a10 10 0 0 1-4.7-1.2" />
          <path d="m4 4 16 16" />
        </>
      }
    />
  ),
  arrowR: <Icon d={<path d="M5 12h14m-6-6 6 6-6 6" />} />,
  arrowL: <Icon d={<path d="M19 12H5m6-6-6 6 6 6" />} />,
  lightbulb: (
    <Icon d={<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.8c.7.6 1 1.2 1 2V18h6v-1.2c0-.8.3-1.4 1-2A7 7 0 0 0 12 2z" />} />
  ),
  target: (
    <Icon
      d={
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" />
        </>
      }
    />
  ),
  trend: (
    <Icon
      d={
        <>
          <path d="m3 17 6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </>
      }
    />
  ),
  star: (
    <Icon d={<path d="m12 3 2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 18l-5.9 3 1.3-6.5L2.5 9.9l6.6-.8z" />} />
  ),
  sun: (
    <Icon
      d={
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" />
        </>
      }
    />
  ),
  moon: <Icon d={<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />} />,
  lamp: (
    <Icon
      d={
        <>
          <path d="M8 3h8l2 7H6z" />
          <path d="M12 10v9M8 22h8" />
        </>
      }
    />
  ),
  drag: (
    <Icon
      d={
        <>
          <circle cx="9" cy="6" r="1" />
          <circle cx="15" cy="6" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="9" cy="18" r="1" />
          <circle cx="15" cy="18" r="1" />
        </>
      }
    />
  ),
  more: (
    <Icon
      d={
        <>
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </>
      }
    />
  ),
  sliders: (
    <Icon
      d={
        <>
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h14M20 18v0" />
          <circle cx="15" cy="6" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="18" cy="18" r="2" />
        </>
      }
    />
  ),
  dot: <Icon d={<circle cx="12" cy="12" r="4" fill="currentColor" />} />,
  network: (
    <Icon
      d={
        <>
          <circle cx="12" cy="5" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
          <path d="M12 7v4M7 14l3-3M17 14l-3-3" />
        </>
      }
    />
  ),
  layers: (
    <Icon
      d={
        <>
          <path d="m12 3 9 5-9 5-9-5z" />
          <path d="m3 13 9 5 9-5M3 18l9 5 9-5" />
        </>
      }
    />
  ),
  clock: (
    <Icon
      d={
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      }
    />
  ),
  filter: <Icon d={<path d="M3 4h18l-7 9v6l-4 2v-8z" />} />,
  refresh: (
    <Icon
      d={
        <>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 21v-5h5" />
        </>
      }
    />
  ),
};
