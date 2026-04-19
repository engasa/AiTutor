import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type RdTheme = 'daylight' | 'lamplight' | 'midnight';
export type RdDensity = 'compact' | 'comfortable' | 'spacious';

export type Tweaks = {
  theme: RdTheme;
  density: RdDensity;
  accentHue: number;
  mascot: boolean;
};

const DEFAULTS: Tweaks = {
  theme: 'daylight',
  density: 'comfortable',
  accentHue: 18,
  mascot: true,
};

type TweaksContextValue = {
  tweaks: Tweaks;
  setTweaks: (next: Tweaks | ((prev: Tweaks) => Tweaks)) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const TweaksContext = createContext<TweaksContextValue | undefined>(undefined);

const STORAGE_KEY = 'aitutor.redesign.tweaks';

function readStored(): Tweaks {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Tweaks>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function TweaksProvider({ children }: { children: ReactNode }) {
  const [tweaks, setTweaksState] = useState<Tweaks>(DEFAULTS);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTweaksState(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.setAttribute('data-redesign', 'on');
    root.setAttribute('data-theme', tweaks.theme);
    root.setAttribute('data-density', tweaks.density);
    root.style.setProperty('--ember', `oklch(.6 .14 ${tweaks.accentHue})`);
    root.style.setProperty('--ember-soft', `oklch(.88 .06 ${tweaks.accentHue})`);
    if (tweaks.theme === 'daylight') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
    try {
      window.localStorage.setItem('theme', tweaks.theme === 'daylight' ? 'light' : 'dark');
    } catch {
      // localStorage unavailable; persistence is best-effort.
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      // localStorage unavailable; persistence is best-effort.
    }
  }, [tweaks, hydrated]);

  const setTweaks = useCallback((next: Tweaks | ((prev: Tweaks) => Tweaks)) => {
    setTweaksState((prev) => (typeof next === 'function' ? (next as (p: Tweaks) => Tweaks)(prev) : next));
  }, []);

  const value = useMemo<TweaksContextValue>(
    () => ({ tweaks, setTweaks, open, setOpen }),
    [tweaks, setTweaks, open],
  );

  return <TweaksContext.Provider value={value}>{children}</TweaksContext.Provider>;
}

export function useTweaks() {
  const ctx = useContext(TweaksContext);
  if (!ctx) throw new Error('useTweaks must be used within TweaksProvider');
  return ctx;
}
