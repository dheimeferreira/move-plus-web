import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseConfigError } from '../lib/supabase';
import { AppError } from '../lib/errors';
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
    // Sem configuração válida não há sessão a restaurar: libera a interface na hora.
    if (supabaseConfigError) {
      setLoading(false);
      return undefined;
    }

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        setSession(data?.session ?? null);
        await loadProfile(data?.session?.user?.id);
      } catch (err) {
        // Sessão corrompida/expirada ou servidor fora: segue deslogado em vez de travar no loader.
        console.warn('[MOVE+] Não foi possível restaurar a sessão:', err?.message || err);
        if (active) setSession(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    let subscription = null;
    try {
      const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
        if (event === 'PASSWORD_RECOVERY') setRecovery(true);
        setSession(next);
        if (event === 'SIGNED_OUT') setProfile(null);
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          // Fora do callback: evita deadlock do supabase-js ao consultar dentro do evento.
          setTimeout(() => loadProfile(next?.user?.id), 0);
        }
      });
      subscription = sub?.subscription ?? null;
    } catch (err) {
      console.warn('[MOVE+] Falha ao observar a sessão:', err?.message || err);
    }
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email, password) => {
    if (supabaseConfigError) throw new AppError('O site está temporariamente mal configurado. Tente novamente mais tarde.', 'CONFIG');
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
    configError: supabaseConfigError,
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
