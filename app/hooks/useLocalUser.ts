import { useEffect, useState } from 'react';
import type { Role, User } from '../lib/types';

const KEY = 'aitutor_current_user';

export function useLocalUser() {
  const [user, setUser] = useState<(Pick<User, 'id' | 'name' | 'role'>) | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {}
    }
  }, []);

  const save = (u: Pick<User, 'id' | 'name' | 'role'> | null) => {
    setUser(u);
    if (u) localStorage.setItem(KEY, JSON.stringify(u));
    else localStorage.removeItem(KEY);
  };

  return { user, setUser: save };
}

export function requireUser(role?: Role) {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as Pick<User, 'id' | 'name' | 'role'>;
    if (role && u.role !== role) return null;
    return u;
  } catch {
    return null;
  }
}

