import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "~/lib/api";
import type { User } from "~/lib/types";

export type AuthUser = Pick<User, "id" | "name" | "role">;

type AuthContextValue = {
  user: AuthUser | null;
  saveAuth: (userData: AuthUser) => void;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  initialUser: AuthUser | null;
  children: React.ReactNode;
};

export function AuthProvider({ initialUser, children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (bootstrapped) return;
    setBootstrapped(true);
    if (initialUser) return;

    api
      .me()
      .then((data) => {
        const nextUser = data?.user ?? null;
        if (nextUser) {
          setUser({ id: nextUser.id, name: nextUser.name, role: nextUser.role });
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        setUser(null);
      });
  }, [bootstrapped, initialUser]);

  const saveAuth = (userData: AuthUser) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error("Failed to log out", error);
    }
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      saveAuth,
      logout,
      setUser,
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useLocalUser() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useLocalUser must be used within an AuthProvider");
  }
  return context;
}
