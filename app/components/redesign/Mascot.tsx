import { useEffect, useState } from 'react';

export type OliverMood = 'idle' | 'thinking';

export function Oliver({
  size = 96,
  mood = 'idle',
  pupilOffset = { x: 0, y: 0 },
}: {
  size?: number;
  mood?: OliverMood;
  pupilOffset?: { x: number; y: number };
}) {
  const [blink, setBlink] = useState(false);
  const [tilt, setTilt] = useState(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const loop = () => {
      const delay = 2400 + Math.random() * 3200;
      timeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        setTilt((Math.random() - 0.5) * 4);
        loop();
      }, delay);
    };
    loop();
    return () => clearTimeout(timeout);
  }, []);

  const pupilFill = 'var(--ink)';
  const bodyFill = 'var(--ember)';
  const softFill = 'var(--paper)';

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      style={{ transform: `rotate(${tilt}deg)`, transition: 'transform .6s ease', display: 'block' }}
    >
      <path
        d="M10 102 Q60 110 110 102"
        stroke="var(--ink-3)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        opacity=".35"
      />
      <path
        d="M60 18c-22 0-36 16-36 38 0 24 16 38 36 38s36-14 36-38c0-22-14-38-36-38z"
        fill={bodyFill}
        stroke="var(--ink)"
        strokeWidth="1.5"
      />
      <path
        d="M42 62c6 4 12 6 18 6s12-2 18-6M44 74c5 3 10 4 16 4s11-1 16-4M48 84c4 2 8 3 12 3s8-1 12-3"
        stroke="var(--ink)"
        strokeWidth="1"
        fill="none"
        opacity=".35"
      />
      <path
        d="M30 22c2 6 5 8 10 10M90 22c-2 6-5 8-10 10"
        stroke="var(--ink)"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M32 38c8-4 16-4 22 2M88 38c-8-4-16-4-22 2"
        stroke="var(--ink)"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="45" cy="48" r="12" fill={softFill} stroke="var(--ink)" strokeWidth="1.4" />
      <circle cx="75" cy="48" r="12" fill={softFill} stroke="var(--ink)" strokeWidth="1.4" />
      {blink ? (
        <path d="M37 48h16M67 48h16" stroke={pupilFill} strokeWidth="2" strokeLinecap="round" />
      ) : (
        <>
          <circle cx={45 + pupilOffset.x * 3} cy={48 + pupilOffset.y * 2} r="4" fill={pupilFill} />
          <circle cx={75 + pupilOffset.x * 3} cy={48 + pupilOffset.y * 2} r="4" fill={pupilFill} />
          <circle cx={46 + pupilOffset.x * 3} cy={47 + pupilOffset.y * 2} r="1.2" fill={softFill} />
          <circle cx={76 + pupilOffset.x * 3} cy={47 + pupilOffset.y * 2} r="1.2" fill={softFill} />
        </>
      )}
      <path
        d="M60 58l-3 6h6z"
        fill="var(--sunset)"
        stroke="var(--ink)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M50 102v4M56 102v4M64 102v4M70 102v4"
        stroke="var(--ink)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {mood === 'thinking' && (
        <g>
          <circle cx="104" cy="22" r="2" fill="var(--ink-3)" />
          <circle cx="108" cy="16" r="1.4" fill="var(--ink-3)" opacity=".7" />
          <circle cx="112" cy="10" r="1" fill="var(--ink-3)" opacity=".5" />
        </g>
      )}
    </svg>
  );
}

export function OliverMini({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      <circle cx="20" cy="22" r="13" fill="var(--ember)" stroke="var(--ink)" strokeWidth="1" />
      <circle cx="15.5" cy="20" r="3.5" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1" />
      <circle cx="24.5" cy="20" r="3.5" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1" />
      <circle cx="15.5" cy="20" r="1.4" fill="var(--ink)" />
      <circle cx="24.5" cy="20" r="1.4" fill="var(--ink)" />
      <path
        d="M20 24l-1.4 2 1.4 1.6 1.4-1.6z"
        fill="var(--sunset)"
        stroke="var(--ink)"
        strokeWidth=".7"
      />
    </svg>
  );
}
