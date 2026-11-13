import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchOwnProfile } from '../services/accountService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    try {
      const data = await fetchOwnProfile(userId);
      setProfile(data);
      return data;
    } catch {
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(next);
      if (event === 'SIGNED_OUT') setProfile(null);
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Fora do callback: evita deadlock do supabase-js ao consultar dentro do evento.
        setTimeout(() => loadProfile(next?.user?.id), 0);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setSession(data.session);
    await loadProfile(data.user?.id);
    return data;
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,
    recovery,
    setRecovery,
    signIn,
    signOut,
    refreshProfile: () => loadProfile(session?.user?.id),
  }), [session, profile, loading, recovery, signIn, signOut, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}
