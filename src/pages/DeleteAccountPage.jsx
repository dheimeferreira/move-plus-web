import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Clock, Smartphone, Trash2, UserX } from 'lucide-react';
import { SITE } from '../config/site';
import { Button } from '../components/ui/Button';
import { TextArea, TextInput } from '../components/ui/Field';
import { Alert } from '../components/ui/Alert';
import { ContactEmail } from '../components/ui/Brand';
import { requestAccountDeletion } from '../services/accountService';
import { isValidEmail } from '../lib/validation';

const IN_APP_STEPS = [
  'Abra o aplicativo MOVE+ e entre na sua conta.',
  'Toque na sua foto (ícone de perfil) no canto superior da tela Início para abrir o Perfil.',
  'Role até a seção CONTA, no final da tela.',
  'Toque em “Excluir minha conta e dados”.',
  'Confirme duas vezes. A exclusão é imediata e você será desconectado.',
];

const DELETED = [
  'Conta de acesso (e-mail e senha) e perfil do atleta',
  'Dados de saúde: peso, medidas, percentual de gordura, patologias e restrições',
  'Todos os treinos, séries, cargas e protocolos gerados pela ZORYX AI',
  'Corridas, trajetos GPS, ritmo e histórico de desempenho',
  'Registros de nutrição, refeições, suplementos e fotos de pratos',
  'Conversas com a ZORYX AI e arquivos enviados (foto de perfil e imagens)',
  'Token de notificações e dados técnicos de sincronização do aparelho',
];

const RETAINED = [
  'Registros de transações financeiras, pelo prazo exigido pela legislação fiscal.',
  'O próprio pedido de exclusão (protocolo, e-mail e data), como comprovação do atendimento à LGPD.',
  'Grupos da comunidade que você criou continuam existindo, sem vínculo com você.',
];

const MIN_FILL_MS = 2500;

function DeletionForm() {
  const [form, setForm] = useState({ email: '', fullName: '', reason: '', confirm: false, website: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ state: 'idle', message: '', protocol: '' });
  const startedAt = useRef(Date.now());

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    if (status.state === 'loading') return;
    const next = {};
    if (!isValidEmail(form.email)) next.email = 'Informe o e-mail usado no cadastro do MOVE+.';
    if (form.fullName.length > 100) next.fullName = 'Até 100 caracteres.';
    if (form.reason.length > 500) next.reason = 'Até 500 caracteres.';
    if (!form.confirm) next.confirm = 'Confirme que entende que a exclusão é definitiva.';
    setErrors(next);
    if (Object.keys(next).length) return;

    // Honeypot e tempo mínimo de preenchimento: bots recebem "sucesso" sem nada ser gravado.
    if (form.website || Date.now() - startedAt.current < MIN_FILL_MS) {
      setStatus({ state: 'done', protocol: '', message: '' });
      return;
    }

    setStatus({ state: 'loading', message: '', protocol: '' });
    try {
      const result = await requestAccountDeletion(form);
      setStatus({ state: 'done', protocol: result?.protocol || '', message: '' });
    } catch (err) {
      setStatus({ state: 'error', message: err.message, protocol: '' });
    }
  }

  if (status.state === 'done') {
    return (
      <div className="surface p-6 sm:p-8" role="status" aria-live="polite">
        <CheckCircle2 className="h-10 w-10 text-ok" aria-hidden="true" />
        <h3 className="display mt-4 text-3xl font-extrabold">Solicitação registrada</h3>
        {status.protocol ? (
          <p className="mt-3 text-muted">
            Seu protocolo é <strong className="font-mono text-fg">{status.protocol}</strong>. Guarde-o para acompanhar o pedido.
          </p>
        ) : null}
        <p className="mt-3 text-sm text-muted">
          Se houver uma conta MOVE+ vinculada a este e-mail, todos os dados descritos acima serão excluídos em até{' '}
          <strong className="text-fg">{SITE.deletionDeadlineDays} dias</strong>. Por segurança, podemos entrar em contato pelo
          e-mail informado para confirmar a titularidade antes da exclusão.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="surface space-y-5 p-6 sm:p-8" aria-describedby="form-intro">
      <div>
        <h3 className="text-xl font-semibold">Formulário de solicitação</h3>
        <p id="form-intro" className="mt-1 text-sm text-muted">
          Para quem já desinstalou o aplicativo ou não consegue mais acessá-lo.
        </p>
      </div>

      {status.state === 'error' ? <Alert tone="error">{status.message}</Alert> : null}

      <TextInput label="E-mail da conta MOVE+" type="email" name="email" autoComplete="email" inputMode="email" maxLength={254}
        required value={form.email} onChange={set('email')} error={errors.email} placeholder="voce@exemplo.com" />
      <TextInput label="Nome completo (opcional)" name="name" autoComplete="name" maxLength={100}
        value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
      <TextArea label="Motivo (opcional)" name="reason" maxLength={500} rows={3} value={form.reason} onChange={set('reason')}
        error={errors.reason} hint={`${form.reason.length}/500`} />

      {/* Honeypot: invisível para pessoas, atraente para bots. */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Site
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
        </label>
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={form.confirm} onChange={set('confirm')}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong accent-[#FF6B00]" aria-invalid={errors.confirm ? 'true' : undefined} />
          <span className="text-muted">
            Entendo que a exclusão é <strong className="text-fg">permanente e irreversível</strong> e que perderei todo o
            meu histórico de treinos, corridas e nutrição.
          </span>
        </label>
        {errors.confirm ? <p className="mt-1.5 text-xs text-red-400">{errors.confirm}</p> : null}
      </div>

      <Button type="submit" variant="danger" loading={status.state === 'loading'} className="w-full">
        <Trash2 className="h-4 w-4" /> Solicitar exclusão da conta
      </Button>
      <p className="text-xs text-subtle">
        Usamos os dados deste formulário apenas para processar seu pedido. Veja a <Link to="/privacidade" className="text-brand underline">Política de Privacidade</Link>.
      </p>
    </form>
  );
}

export default function DeleteAccountPage() {
  return (
    <div className="container-page py-14 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand">
          <UserX className="h-4 w-4" /> Exclusão de conta • LGPD
        </p>
        <h1 className="display mt-3 text-5xl font-extrabold leading-[0.95] sm:text-6xl">
          Excluir sua conta do <span className="text-brand">MOVE+</span>
        </h1>
        <p className="mt-4 max-w-3xl text-muted">
          Esta página explica como solicitar a exclusão da sua conta e dos dados associados ao aplicativo{' '}
          <strong className="text-fg">{SITE.appName}</strong>, desenvolvido por <strong className="text-fg">MOVE+</strong> e
          disponível no Google Play.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="no-app" className="surface p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/12 text-brand"><Smartphone className="h-5 w-5" /></span>
              <div>
                <h2 id="no-app" className="text-xl font-semibold">Opção 1 — Pelo aplicativo</h2>
                <p className="text-sm text-muted">Mais rápido: exclusão imediata.</p>
              </div>
            </div>
            <ol className="mt-6 space-y-4">
              {IN_APP_STEPS.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="display flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand/40 text-lg font-extrabold text-brand">{i + 1}</span>
                  <span className="pt-1 text-sm text-muted">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="no-web">
            <h2 id="no-web" className="sr-only">Opção 2 — Pelo formulário</h2>
            <DeletionForm />
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="surface p-6 lg:col-span-2" aria-labelledby="apagados">
            <h2 id="apagados" className="text-lg font-semibold">Dados que serão excluídos</h2>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {DELETED.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-muted">
                  <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>
            <h3 className="mt-6 text-sm font-semibold">Dados que podem ser mantidos</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              {RETAINED.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </section>

          <section className="surface p-6" aria-labelledby="prazo">
            <Clock className="h-6 w-6 text-brand" aria-hidden="true" />
            <h2 id="prazo" className="mt-3 text-lg font-semibold">Prazo</h2>
            <ul className="mt-3 space-y-3 text-sm text-muted">
              <li><strong className="text-fg">Pelo app:</strong> imediato e definitivo.</li>
              <li><strong className="text-fg">Pelo formulário:</strong> até {SITE.deletionDeadlineDays} dias após a solicitação.</li>
              <li><strong className="text-fg">Cópias de segurança:</strong> removidas automaticamente no ciclo de expiração dos backups.</li>
            </ul>
            <p className="mt-4 text-xs text-subtle">
              Assinatura VIP: cancele também a assinatura no Google Play (Pagamentos e assinaturas) para evitar novas cobranças.
              Dúvidas: <ContactEmail />.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
