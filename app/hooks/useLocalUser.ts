import { useEffect, useState } from 'react';
import type { Role, User } from '../lib/types';

const TOKEN_KEY = 'aitutor_auth_token';

function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token);
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

export function useLocalUser() {
  const [user, setUser] = useState<(Pick<User, 'id' | 'name' | 'role'>) | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken && !isTokenExpired(storedToken)) {
      setToken(storedToken);
      const payload = parseJwtPayload(storedToken);
      if (payload) {
        // We'll need to get user details from the token or make an API call
        // For now, we'll store minimal info from the token
        setUser({
          id: payload.userId,
          name: '', // We'll get this from API calls
          role: payload.role
        });
      }
    } else {
      // Clear expired token
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  const saveAuth = (authToken: string, userData: Pick<User, 'id' | 'name' | 'role'>) => {
    setToken(authToken);
    setUser(userData);
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, authToken);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  };

  const getToken = () => {
    if (typeof window === 'undefined') return null;

    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken && !isTokenExpired(storedToken)) {
      return storedToken;
    }
    return null;
  };

  return { user, token: getToken(), saveAuth, logout };
}

export function requireUser(role?: Role) {
  if (typeof window === 'undefined') return null;

  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (!storedToken || isTokenExpired(storedToken)) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }

  const payload = parseJwtPayload(storedToken);
  if (!payload) return null;

  const user = { id: payload.userId, name: '', role: payload.role };
  if (role && user.role !== role) return null;
  return user;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (storedToken && !isTokenExpired(storedToken)) {
    return storedToken;
  }
  localStorage.removeItem(TOKEN_KEY);
  return null;
}

