import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiBase } from '../services/auth';

export type AuthUser = {
  id: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
};

export type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user?: AuthUser) => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TOKEN_STORAGE_KEY = 'auth_token';
function buildVerifyUrl(): string {
  try {
    const base = apiBase();
    return `${base.replace(/\/$/, '')}/auth/verify`;
  } catch {
    return '/auth/verify';
  }
}

async function fetchUserWithToken(token: string, signal?: AbortSignal): Promise<AuthUser> {
  const response = await fetch(buildVerifyUrl(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    throw new Error('Unable to verify token');
  }

  const payload = await response.json();
  return {
    id: String(payload.id ?? payload.sub ?? ''),
    email: payload.email,
    name: payload.name ?? payload.full_name ?? payload.preferred_username ?? payload.email,
    ...payload,
  } as AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const hydrateFromToken = useCallback(async (token: string, signal?: AbortSignal) => {
    const currentUser = await fetchUserWithToken(token, signal);
    setUser(currentUser);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const token = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;

    if (!token) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    const verify = async () => {
      try {
        await hydrateFromToken(token, controller.signal);
      } catch (error) {
        if (!isMounted || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        console.warn('Initial auth verification failed', error);
        logout();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    verify();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [hydrateFromToken, logout]);

  const refresh = useCallback(async () => {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;
    if (!token) {
      logout();
      return;
    }

    setIsLoading(true);
    try {
      await hydrateFromToken(token);
    } catch (error) {
      console.warn('Token refresh failed', error);
      logout();
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [hydrateFromToken, logout]);

  const login = useCallback(
    (token: string, payload?: AuthUser) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
      setIsAuthenticated(true);
      if (payload) {
        setUser(payload);
        return;
      }
      void refresh();
    },
    [refresh],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated, isLoading, login, logout, refresh }),
    [user, isAuthenticated, isLoading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
