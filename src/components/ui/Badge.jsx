import { ROLE_LABEL } from '../../config/site';

const TONES = {
  brand: 'bg-brand/15 text-brand border-brand/30',
  ok: 'bg-ok/10 text-green-400 border-ok/30',
  warn: 'bg-warn/10 text-amber-400 border-warn/30',
  danger: 'bg-danger/10 text-red-400 border-danger/30',
  muted: 'bg-white/5 text-muted border-line',
  info: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  violet: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
};

export function Badge({ tone = 'muted', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

const ROLE_TONE = { user: 'muted', vip: 'brand', personal: 'info', nutricionista: 'violet', admin: 'warn' };

export function RoleBadge({ role }) {
  const key = ROLE_LABEL[role] ? role : 'user';
  return <Badge tone={ROLE_TONE[key]}>{ROLE_LABEL[key]}</Badge>;
}
