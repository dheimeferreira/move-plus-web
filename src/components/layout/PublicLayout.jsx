import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Menu, X } from 'lucide-react';
import { Logo } from '../ui/Brand';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { SITE } from '../../config/site';

const NAV = [
  { href: '/#zoryx', label: 'ZORYX AI' },
  { href: '/#recursos', label: 'Recursos' },
  { href: '/#planos', label: 'Planos' },
  { href: '/#loja', label: 'Loja' },
];

function Header() {
  const { user, role } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-fg">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {role === 'admin' ? <Button to="/admin" variant="ghost" size="sm">Painel admin</Button> : null}
              <Button to="/minha-conta" size="sm">Minha conta</Button>
            </>
          ) : (
            <>
              <Button to="/entrar" variant="ghost" size="sm">Entrar</Button>
              <Button href={SITE.playStoreUrl} size="sm">Baixar app</Button>
            </>
          )}
        </div>
        <button type="button" className="rounded-lg p-2 text-muted hover:bg-card hover:text-fg md:hidden" onClick={() => setOpen((v) => !v)}
          aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Fechar menu' : 'Abrir menu'}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open ? (
        <nav id="mobile-nav" className="border-t border-line bg-ink md:hidden" aria-label="Menu móvel">
          <div className="container-page flex flex-col gap-1 py-4">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="rounded-lg px-3 py-3 text-base font-medium text-muted hover:bg-card hover:text-fg">{item.label}</a>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {user ? (
                <Button to="/minha-conta" className="col-span-2">Minha conta</Button>
              ) : (
                <>
                  <Button to="/entrar" variant="secondary">Entrar</Button>
                  <Button href={SITE.playStoreUrl}>Baixar app</Button>
                </>
              )}
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-ink">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted">
            Treino adaptativo com IA, corrida com GPS e nutrição inteligente. Um só app para evoluir com dados.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Produto</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a className="text-muted hover:text-fg" href="/#zoryx">ZORYX AI</a></li>
            <li><a className="text-muted hover:text-fg" href="/#recursos">Recursos</a></li>
            <li><a className="text-muted hover:text-fg" href="/#planos">Planos</a></li>
            <li><a className="text-muted hover:text-fg" href={SITE.playStoreUrl} target="_blank" rel="noopener noreferrer">Google Play</a></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Conta</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-muted hover:text-fg" to="/entrar">Entrar</Link></li>
            <li><Link className="text-muted hover:text-fg" to="/minha-conta">Minha conta</Link></li>
            <li><Link className="text-muted hover:text-fg" to="/excluir-conta">Excluir conta e dados</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Legal</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-muted hover:text-fg" to="/privacidade">Política de Privacidade</Link></li>
            <li><Link className="text-muted hover:text-fg" to="/excluir-conta">Exclusão de conta (LGPD)</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MOVE+. Todos os direitos reservados.</p>
          <p>As orientações da ZORYX AI têm caráter esportivo e não substituem avaliação médica.</p>
        </div>
      </div>
    </footer>
  );
}

/** Rola para o topo ou para a âncora (#secao) a cada navegação. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-black">
        Pular para o conteúdo
      </a>
      <ScrollManager />
      <Header />
      <main id="conteudo" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export function NavItem({ to, end, icon: Icon, children }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => `flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-brand/12 text-brand' : 'text-muted hover:bg-card-2 hover:text-fg'}`}>
      {Icon ? <Icon className="h-4.5 w-4.5" aria-hidden="true" /> : null}
      {children}
    </NavLink>
  );
}
