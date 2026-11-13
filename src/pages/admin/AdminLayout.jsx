import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { Dumbbell, LayoutDashboard, LogOut, ShoppingBag, UserX, Users, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../../components/ui/Brand';
import { NavItem } from '../../components/layout/PublicLayout';
import { InlineLoader } from '../../components/ui/Spinner';

const NAV = [
  { to: '/admin', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/usuarios', icon: Users, label: 'Usuários & Equipe' },
  { to: '/admin/exercicios', icon: Dumbbell, label: 'Exercícios' },
  { to: '/admin/loja', icon: ShoppingBag, label: 'Loja MOVE+' },
  { to: '/admin/exclusoes', icon: UserX, label: 'Exclusões LGPD' },
];

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between px-4 lg:h-20 lg:px-5">
          <Logo to="/admin" suffix="Master" />
          <button type="button" onClick={signOut} className="rounded-lg p-2 text-muted hover:bg-card hover:text-fg lg:hidden" aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Painel administrativo" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-4">
          {NAV.map((item) => (
            <NavItem key={item.to} to={item.to} end={item.end} icon={item.icon}>{item.label}</NavItem>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 hidden border-t border-line p-4 lg:block">
          <a href="/" className="mb-3 flex items-center gap-2 text-xs text-muted hover:text-fg"><ExternalLink className="h-3.5 w-3.5" /> Ver site público</a>
          <p className="truncate text-xs text-subtle" title={user?.email}>{user?.email}</p>
          <button type="button" onClick={signOut} className="mt-2 flex items-center gap-2 text-sm font-medium text-muted hover:text-red-400">
            <LogOut className="h-4 w-4" /> Encerrar sessão
          </button>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-10">
        <Suspense fallback={<InlineLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="display text-4xl font-extrabold leading-none">{title}</h1>
        {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
