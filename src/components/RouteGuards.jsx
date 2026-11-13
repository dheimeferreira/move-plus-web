import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { fetchIsAdmin } from '../services/adminService';
import { FullScreenLoader } from './ui/Spinner';

/** Exige sessão. Sem login → /entrar (guardando o destino). */
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader label="Verificando sua sessão…" />;
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return children;
}

/**
 * Exige administrador, com duas confirmações independentes:
 *   1. profiles.role === 'admin' (lido com o token do próprio usuário, RLS);
 *   2. RPC public.is_admin() === true (a mesma função que protege todas as policies e RPCs).
 * Qualquer falha, demora ou divergência nega o acesso e redireciona imediatamente.
 * Mesmo que alguém burle esta tela no navegador, o banco recusa toda leitura/escrita administrativa.
 */
export function RequireAdmin({ children }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  const [check, setCheck] = useState({ userId: null, ok: null });

  useEffect(() => {
    if (loading || !user || role !== 'admin') return;
    let active = true;
    fetchIsAdmin().then((ok) => active && setCheck({ userId: user.id, ok }));
    return () => {
      active = false;
    };
  }, [loading, user, role]);

  if (loading) return <FullScreenLoader label="Verificando permissões…" />;
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  if (role !== 'admin') return <Navigate to="/minha-conta" replace />;
  if (check.userId !== user.id || check.ok === null) return <FullScreenLoader label="Confirmando acesso administrativo…" />;
  if (!check.ok) return <Navigate to="/minha-conta" replace />;
  return children;
}
