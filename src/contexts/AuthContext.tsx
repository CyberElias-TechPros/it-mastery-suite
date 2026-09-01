import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiFetch, errorMessage, getAccessToken, onAuthChange, refreshAccessToken, setAccessToken } from '@/lib/api';

export type Role = 'admin' | 'technician' | 'employee';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  phone?: string | null;
  department?: string | null;
  avatar_url?: string | null;
  branch_id?: string | null;
  department_id?: string | null;
  branch_name?: string | null;
  department_name?: string | null;
  is_active?: boolean | number;
  created_at?: string;
  updated_at?: string;
}

interface SessionPayload {
  accessToken: string;
  expiresIn: number;
  user: Profile;
}

export interface AuthContextType {
  /** Present for API compatibility with the previous provider: same object as `profile`. */
  user: Profile | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Omit<Profile, 'id' | 'email' | 'role'>>) => Promise<{ error: Error | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Refresh the access token a minute before it expires. */
const REFRESH_MARGIN_SECONDS = 60;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>();

  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const delay = Math.max(expiresIn - REFRESH_MARGIN_SECONDS, 30) * 1000;
    refreshTimer.current = setTimeout(() => {
      void refreshAccessToken();
    }, delay);
  }, []);

  const adoptSession = useCallback(
    (session: SessionPayload) => {
      setAccessToken(session.accessToken);
      setProfile(session.user);
      scheduleRefresh(session.expiresIn);
    },
    [scheduleRefresh],
  );

  // Restore a session from the HttpOnly refresh cookie on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiFetch<SessionPayload>('/auth/refresh', { method: 'POST', json: {}, skipRefresh: true });
        if (!cancelled && data?.accessToken) adoptSession(data);
      } catch {
        if (!cancelled) {
          setAccessToken(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adoptSession]);

  // If any request ends up clearing the token, drop the profile too.
  useEffect(
    () =>
      onAuthChange((token) => {
        if (!token) {
          setProfile(null);
          if (refreshTimer.current) clearTimeout(refreshTimer.current);
        }
      }),
    [],
  );

  useEffect(() => () => refreshTimer.current && clearTimeout(refreshTimer.current), []);

  const signIn = useCallback<AuthContextType['signIn']>(
    async (email, password) => {
      try {
        const session = await api.post<SessionPayload>('/auth/login', { email, password }, { skipRefresh: true });
        adoptSession(session);
        return { error: null };
      } catch (error) {
        return { error: new Error(errorMessage(error, 'Unable to sign in.')) };
      }
    },
    [adoptSession],
  );

  const signUp = useCallback<AuthContextType['signUp']>(
    async (email, password, fullName) => {
      try {
        const session = await api.post<SessionPayload>('/auth/register', { email, password, fullName }, { skipRefresh: true });
        adoptSession(session);
        return { error: null };
      } catch (error) {
        return { error: new Error(errorMessage(error, 'Unable to create the account.')) };
      }
    },
    [adoptSession],
  );

  const signOut = useCallback(async () => {
    try {
      if (getAccessToken()) await api.post('/auth/logout', {});
    } catch {
      // Signing out locally must succeed even if the API call fails.
    } finally {
      setAccessToken(null);
      setProfile(null);
      navigate('/auth', { replace: true });
    }
  }, [navigate]);

  const refreshProfile = useCallback(async () => {
    try {
      setProfile(await api.get<Profile>('/auth/me'));
    } catch {
      // Ignored: the interceptor already handles expired sessions.
    }
  }, []);

  const updateProfile = useCallback<AuthContextType['updateProfile']>(async (updates) => {
    try {
      const updated = await api.put<Profile>('/auth/me', {
        fullName: updates.full_name ?? undefined,
        phone: updates.phone ?? undefined,
        department: updates.department ?? undefined,
        avatarUrl: updates.avatar_url ?? undefined,
      });
      setProfile(updated);
      return { error: null };
    } catch (error) {
      return { error: new Error(errorMessage(error, 'Unable to update your profile.')) };
    }
  }, []);

  const changePassword = useCallback<AuthContextType['changePassword']>(async (currentPassword, newPassword) => {
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      // The API revokes every session on a credential change, so drop ours too.
      setAccessToken(null);
      setProfile(null);
      return { error: null };
    } catch (error) {
      return { error: new Error(errorMessage(error, 'Unable to change your password.')) };
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user: profile,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      isStaff: profile?.role === 'admin' || profile?.role === 'technician',
      signIn,
      signUp,
      signOut,
      updateProfile,
      changePassword,
      refreshProfile,
    }),
    [profile, loading, signIn, signUp, signOut, updateProfile, changePassword, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
