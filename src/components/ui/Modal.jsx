import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Diálogo acessível: foco preso, Esc fecha, conteúdo rola por dentro. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const node = ref.current;
    const items = () => [...(node?.querySelectorAll(FOCUSABLE) || [])];
    const firstField = node?.querySelector('input, select, textarea');
    (firstField || items()[0] || node)?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current?.();
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const width = size === 'lg' ? 'sm:max-w-3xl' : size === 'sm' ? 'sm:max-w-md' : 'sm:max-w-xl';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full ${width} flex-col rounded-t-2xl border border-line bg-card shadow-2xl sm:rounded-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-card-2 hover:text-fg" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirmar', tone = 'primary', loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={(
        <>
          <button type="button" onClick={onClose} className="h-10 rounded-xl px-4 text-sm font-semibold text-muted hover:bg-card-2 hover:text-fg">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className={`h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50 ${tone === 'danger' ? 'bg-danger text-white hover:bg-red-500' : 'bg-brand text-black hover:bg-brand-hover'}`}>
            {loading ? 'Aguarde…' : confirmLabel}
          </button>
        </>
      )}>
      <div className="space-y-2 text-sm text-muted">{children}</div>
    </Modal>
  );
}
