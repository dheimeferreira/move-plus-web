import { Link } from 'react-router';
import { SITE } from '../../config/site';

export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="1" y="1" width="62" height="62" rx="14" fill="#18181B" stroke="#27272A" strokeWidth="2" />
      <path d="M14 46V18h7l11 15 11-15h7v28h-7V30l-11 14-11-14v16z" fill="#FAFAFA" />
      <path d="M47 8h5v6h6v5h-6v6h-5v-6h-6v-5h6z" fill="#FF6B00" />
    </svg>
  );
}

export function Logo({ to = '/', suffix }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="MOVE+ — página inicial">
      <LogoMark />
      <span className="display text-2xl font-extrabold leading-none tracking-tight">
        MOVE<span className="text-brand">+</span>
      </span>
      {suffix ? (
        <span className="ml-1 rounded-md border border-brand/40 bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">{suffix}</span>
      ) : null}
    </Link>
  );
}

/** Botão "Disponível no Google Play" (desenho próprio). */
export function PlayButton({ className = '' }) {
  return (
    <a href={SITE.playStoreUrl} target="_blank" rel="noopener noreferrer"
      className={`inline-flex h-13 items-center gap-3 rounded-xl border border-line-strong bg-black px-5 text-left transition hover:border-brand/60 ${className}`}
      aria-label="Baixar o MOVE+ no Google Play">
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path fill="#34A853" d="M3.6 1.8 13.4 12l-9.8 10.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1z" />
        <path fill="#FBBC04" d="m16.8 8.6-3.4 3.4 3.4 3.4 3.8-2.2c.9-.5.9-1.9 0-2.4z" />
        <path fill="#EA4335" d="M13.4 12 3.6 22.2c.3.2.8.2 1.2 0l12-6.8z" />
        <path fill="#4285F4" d="M3.6 1.8c.4-.2.8-.2 1.2 0l12 6.8-3.4 3.4z" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[10px] uppercase tracking-wider text-muted">Disponível no</span>
        <span className="block text-base font-semibold">Google Play</span>
      </span>
    </a>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      {Icon ? <Icon className="mb-3 h-8 w-8 text-subtle" aria-hidden="true" /> : null}
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Contato público do responsável pelos dados (configurável por VITE_CONTACT_EMAIL). */
export function ContactEmail() {
  if (!SITE.contactEmail) return <strong>pelo canal de suporte dentro do aplicativo</strong>;
  return <a href={`mailto:${SITE.contactEmail}`} className="text-brand underline underline-offset-2">{SITE.contactEmail}</a>;
}
