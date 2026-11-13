import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Logo } from '../components/ui/Brand';
import { Button } from '../components/ui/Button';
import { TextInput } from '../components/ui/Field';
import { Alert } from '../components/ui/Alert';
import { isValidEmail, normalizeEmail } from '../lib/validation';
import { friendlyError } from '../lib/errors';
import { FullScreenLoader } from '../components/ui/Spinner';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

/** Destino interno seguro (impede open redirect: só caminhos relativos do próprio site). */
const safeDestination = (from) => (typeof from === 'string' && /^\/(?!\/)[\w\-/]*$/.test(from) && from !== '/entrar' ? from : null);

export default function LoginPage() {
  const { user, role, loading, signIn, configError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = safeDestination(location.state?.from);

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const attempts = useRef(0);

  useEffect(() => {
    if (lockedUntil <= Date.now()) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  if (loading) return <FullScreenLoader />;
  if (user && !busy) return <Navigate to={from || (role === 'admin' ? '/admin' : '/minha-conta')} replace />;

  const locked = lockedUntil > now;

  async function onLogin(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (locked) return;
    if (configError) {
      setError('O login está temporariamente indisponível por um problema de configuração do site.');
      return;
    }
    if (!isValidEmail(email) || password.length < 6) {
      setError('Informe um e-mail válido e sua senha.');
      return;
    }
    setBusy(true);
    try {
      const session = await signIn(normalizeEmail(email), password);
      attempts.current = 0;
      let nextRole = null;
      try {
        const { data } = await supabase.from('profiles').select('role').eq('id', session?.user?.id).maybeSingle();
        nextRole = data?.role ?? null;
      } catch {
        // Sem o cargo, cai na área do aluno; o /admin revalida no servidor de qualquer forma.
      }
      navigate(from || (nextRole === 'admin' ? '/admin' : '/minha-conta'), { replace: true });
    } catch (err) {
      if (err?.code === 'CONFIG') {
        setError(err.message);
        return;
      }
      attempts.current += 1;
      if (attempts.current >= MAX_ATTEMPTS) {
        attempts.current = 0;
        setLockedUntil(Date.now() + LOCK_MS);
        setNow(Date.now());
      }
      // Mensagem única: não revela se o e-mail existe.
      const msg = /invalid login|invalid credentials|email not confirmed/i.test(err?.message || '')
        ? 'E-mail ou senha incorretos.'
        : friendlyError(err, 'Não foi possível entrar agora. Tente novamente.');
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e) {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo: `${window.location.origin}/redefinir-senha` });
    } catch {
      // Resposta idêntica com ou sem erro: não revela se o e-mail existe.
    }
    setBusy(false);
    setInfo('Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha em instantes.');
    setMode('login');
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden="true" />
      <div className="absolute left-1/2 top-1/3 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-brand/15 blur-[110px]" aria-hidden="true" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" /> Voltar ao site</Link>
        </div>
        <div className="surface p-6 shadow-2xl sm:p-8">
          <h1 className="display text-4xl font-extrabold">{mode === 'login' ? 'Entrar' : 'Recuperar senha'}</h1>
          <p className="mt-1 text-sm text-muted">
            {mode === 'login' ? 'Use o mesmo e-mail e senha do aplicativo MOVE+.' : 'Enviaremos um link de redefinição para o seu e-mail.'}
          </p>

          <div className="mt-6 space-y-4">
            {configError ? (
              <Alert tone="warn">O login está temporariamente indisponível por manutenção. Tente novamente em alguns minutos.</Alert>
            ) : null}
            {error ? <Alert tone="error">{error}</Alert> : null}
            {info ? <Alert tone="ok">{info}</Alert> : null}
            {locked ? <Alert tone="warn">Muitas tentativas. Aguarde {Math.ceil((lockedUntil - now) / 1000)} s para tentar de novo.</Alert> : null}
          </div>

          <form onSubmit={mode === 'login' ? onLogin : onReset} className="mt-4 space-y-4" noValidate>
            <div className="relative">
              <TextInput label="E-mail" type="email" autoComplete="email" inputMode="email" maxLength={254} required
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
              <Mail className="pointer-events-none absolute right-3 top-[38px] h-4 w-4 text-subtle" aria-hidden="true" />
            </div>
            {mode === 'login' ? (
              <div className="relative">
                <TextInput label="Senha" type="password" autoComplete="current-password" maxLength={128} required
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <Lock className="pointer-events-none absolute right-3 top-[38px] h-4 w-4 text-subtle" aria-hidden="true" />
              </div>
            ) : null}
            <Button type="submit" className="w-full" loading={busy} disabled={locked}>
              {mode === 'login' ? 'Entrar' : 'Enviar link'}
            </Button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
            <button type="button" className="text-muted hover:text-brand" onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setError(''); }}>
              {mode === 'login' ? 'Esqueci minha senha' : 'Voltar para o login'}
            </button>
            <span className="text-subtle">Sem conta? Crie pelo app.</span>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-subtle">
          Ao entrar, você concorda com a <Link to="/privacidade" className="underline hover:text-fg">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  );
}
