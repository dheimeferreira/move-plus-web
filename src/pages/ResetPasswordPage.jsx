import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/ui/Brand';
import { Button } from '../components/ui/Button';
import { TextInput } from '../components/ui/Field';
import { Alert } from '../components/ui/Alert';
import { FullScreenLoader } from '../components/ui/Spinner';
import { friendlyError } from '../lib/errors';

/** Aberta pelo link do e-mail de recuperação (o supabase-js troca o código da URL por uma sessão). */
export default function ResetPasswordPage() {
  const { user, loading, setRecovery } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (loading) return <FullScreenLoader label="Validando link…" />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('A nova senha precisa de pelo menos 8 caracteres.');
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return setError('Use letras e números na nova senha.');
    if (password !== confirm) return setError('As senhas não coincidem.');
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(friendlyError(err, 'Não foi possível atualizar a senha. Peça um novo link.'));
    setRecovery(false);
    setDone(true);
    setTimeout(() => navigate('/minha-conta', { replace: true }), 1500);
    return undefined;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8"><Logo /></div>
        <div className="surface p-6 sm:p-8">
          <h1 className="display text-4xl font-extrabold">Nova senha</h1>
          {!user ? (
            <div className="mt-6 space-y-4">
              <Alert tone="warn">Link inválido ou expirado. Solicite um novo na tela de login.</Alert>
              <Button to="/entrar" className="w-full">Ir para o login</Button>
            </div>
          ) : done ? (
            <Alert tone="ok" className="mt-6">Senha atualizada! Redirecionando…</Alert>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              {error ? <Alert tone="error">{error}</Alert> : null}
              <TextInput label="Nova senha" type="password" autoComplete="new-password" maxLength={128} value={password}
                onChange={(e) => setPassword(e.target.value)} hint="Mínimo de 8 caracteres, com letras e números." />
              <TextInput label="Confirme a nova senha" type="password" autoComplete="new-password" maxLength={128} value={confirm}
                onChange={(e) => setConfirm(e.target.value)} />
              <Button type="submit" className="w-full" loading={busy}>Salvar nova senha</Button>
            </form>
          )}
          <p className="mt-5 text-center text-sm"><Link to="/" className="text-muted hover:text-fg">Voltar ao site</Link></p>
        </div>
      </div>
    </div>
  );
}
