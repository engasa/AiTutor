import { I } from './icons';
import { useTweaks, type RdTheme, type RdDensity } from './tweaks';

export function TweaksPanel() {
  const { tweaks, setTweaks, open, setOpen } = useTweaks();
  if (!open) return null;

  const set = <K extends keyof typeof tweaks>(k: K, v: (typeof tweaks)[K]) =>
    setTweaks((t) => ({ ...t, [k]: v }));

  const themes: { id: RdTheme; label: string; icon: React.ReactNode }[] = [
    { id: 'daylight', label: 'Daylight', icon: I.sun },
    { id: 'lamplight', label: 'Lamplight', icon: I.lamp },
    { id: 'midnight', label: 'Midnight', icon: I.moon },
  ];
  const densities: RdDensity[] = ['compact', 'comfortable', 'spacious'];

  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        width: 340,
        background: 'var(--paper-2)',
        border: '1px solid var(--line-2)',
        borderRadius: 'var(--rd-radius)',
        boxShadow: 'var(--rd-shadow-3)',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--paper)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--ember)' }}>{I.sliders}</span>
          <div style={{ fontFamily: 'var(--rd-font-display)', fontSize: 20 }}>Tweaks</div>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--ink-3)',
          }}
        >
          {I.x}
        </button>
      </div>
      <div style={{ padding: '18px', display: 'grid', gap: 18 }}>
        <div>
          <div
            style={{
              fontFamily: 'var(--rd-font-mono)',
              fontSize: 11,
              color: 'var(--ink-3)',
              letterSpacing: '.08em',
              marginBottom: 8,
            }}
          >
            THEME
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => set('theme', t.id)}
                style={{
                  padding: '10px 6px',
                  borderRadius: 10,
                  background: tweaks.theme === t.id ? 'var(--ink)' : 'transparent',
                  color: tweaks.theme === t.id ? 'var(--paper)' : 'var(--ink-2)',
                  border: `1px solid ${tweaks.theme === t.id ? 'var(--ink)' : 'var(--line)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11.5,
                  fontFamily: 'var(--rd-font-ui)',
                }}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--rd-font-mono)',
              fontSize: 11,
              color: 'var(--ink-3)',
              letterSpacing: '.08em',
              marginBottom: 8,
            }}
          >
            DENSITY
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {densities.map((d) => (
              <button
                key={d}
                onClick={() => set('density', d)}
                style={{
                  padding: '8px',
                  borderRadius: 10,
                  background: tweaks.density === d ? 'var(--ink)' : 'transparent',
                  color: tweaks.density === d ? 'var(--paper)' : 'var(--ink-2)',
                  border: `1px solid ${tweaks.density === d ? 'var(--ink)' : 'var(--line)'}`,
                  cursor: 'pointer',
                  fontSize: 12,
                  textTransform: 'capitalize',
                  fontFamily: 'var(--rd-font-ui)',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--rd-font-mono)',
              fontSize: 11,
              color: 'var(--ink-3)',
              letterSpacing: '.08em',
              marginBottom: 8,
            }}
          >
            ACCENT HUE · {tweaks.accentHue}°
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={tweaks.accentHue}
            onChange={(e) => set('accentHue', +e.target.value)}
            style={{ width: '100%', accentColor: 'var(--ember)' }}
          />
          <div
            style={{
              height: 10,
              borderRadius: 999,
              marginTop: 6,
              background:
                'linear-gradient(to right, oklch(.6 .14 0), oklch(.6 .14 60), oklch(.6 .14 120), oklch(.6 .14 180), oklch(.6 .14 240), oklch(.6 .14 300), oklch(.6 .14 360))',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Oliver the owl</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              mascot in chat & empty states
            </div>
          </div>
          <button
            onClick={() => set('mascot', !tweaks.mascot)}
            style={{
              width: 36,
              height: 22,
              borderRadius: 999,
              background: tweaks.mascot ? 'var(--ink)' : 'var(--paper-3)',
              border: '1px solid var(--line-2)',
              position: 'relative',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: tweaks.mascot ? 16 : 2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'var(--paper)',
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
