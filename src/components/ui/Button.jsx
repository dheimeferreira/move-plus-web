import { Link } from 'react-router';
import { Spinner } from './Spinner';

const VARIANTS = {
  primary: 'bg-brand text-black hover:bg-brand-hover shadow-[0_8px_30px_-8px_rgba(255,107,0,0.6)]',
  secondary: 'border border-line-strong bg-card text-fg hover:border-brand/60 hover:bg-card-2',
  ghost: 'text-muted hover:text-fg hover:bg-card',
  danger: 'border border-danger/40 bg-danger/10 text-red-300 hover:bg-danger/20',
};
const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-7 text-base gap-2.5',
};

export function Button({ to, href, variant = 'primary', size = 'md', loading = false, className = '', children, disabled, type = 'button', ...rest }) {
  const cls = `inline-flex select-none items-center justify-center rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  const content = (
    <>
      {loading ? <Spinner className="h-4 w-4 text-current" /> : null}
      {children}
    </>
  );
  if (to) return <Link to={to} className={cls} {...rest}>{content}</Link>;
  if (href) return <a href={href} className={cls} target="_blank" rel="noopener noreferrer" {...rest}>{content}</a>;
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}
