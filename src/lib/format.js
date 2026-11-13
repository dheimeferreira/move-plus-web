const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const numberFmt = new Intl.NumberFormat('pt-BR');
const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (value) => (toDate(value) ? dateFmt.format(toDate(value)) : '—');
export const formatDateTime = (value) => (toDate(value) ? dateTimeFmt.format(toDate(value)) : '—');
export const formatNumber = (value) => (Number.isFinite(Number(value)) ? numberFmt.format(Number(value)) : '—');
export const formatBRL = (cents) => (Number.isFinite(Number(cents)) ? brlFmt.format(Number(cents) / 100) : '—');

export function formatRelative(value) {
  const d = toDate(value);
  if (!d) return 'nunca';
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  return formatDate(d);
}

export const initials = (name = '') =>
  String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'M+';
