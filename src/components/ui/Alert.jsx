import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

const STYLES = {
  info: ['border-sky-500/30 bg-sky-500/10 text-sky-200', Info],
  ok: ['border-ok/30 bg-ok/10 text-green-200', CheckCircle2],
  warn: ['border-warn/30 bg-warn/10 text-amber-200', AlertTriangle],
  error: ['border-danger/40 bg-danger/10 text-red-200', XCircle],
};

export function Alert({ tone = 'info', title, children, className = '' }) {
  const [cls, Icon] = STYLES[tone];
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${cls} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div> : null}
      </div>
    </div>
  );
}
