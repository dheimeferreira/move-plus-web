export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin text-brand ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FullScreenLoader({ label = 'Carregando…' }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ink" role="status" aria-live="polite">
      <Spinner className="h-8 w-8" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export function InlineLoader({ label = 'Carregando…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted" role="status">
      <Spinner /> {label}
    </div>
  );
}
