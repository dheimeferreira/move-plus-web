import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Inbox } from 'lucide-react';
import { PageHeader } from './AdminLayout';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { FilterChips, Select, TextArea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { InlineLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/Brand';
import { DELETION_STATUS, listDeletionRequests, updateDeletionRequest } from '../../services/adminService';
import { formatDateTime } from '../../lib/format';
import { SITE } from '../../config/site';

const TONE = { pending: 'warn', in_progress: 'info', completed: 'ok', rejected: 'muted' };
const LABEL = Object.fromEntries(DELETION_STATUS.map((s) => [s.key, s.label]));
const FILTERS = [{ key: 'open', label: 'Em aberto' }, ...DELETION_STATUS, { key: 'all', label: 'Todas' }];

function daysLeft(createdAt) {
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  return Math.ceil(SITE.deletionDeadlineDays - elapsed);
}

function HandleModal({ item, onClose, onSaved }) {
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.admin_notes || '');
  const [state, setState] = useState({ saving: false, error: '' });

  async function save() {
    setState({ saving: true, error: '' });
    try {
      await updateDeletionRequest(item.id, { status, adminNotes: notes });
      onSaved();
    } catch (err) {
      setState({ saving: false, error: err.message });
    }
  }

  return (
    <Modal open onClose={onClose} title={`Protocolo ${item.protocol}`} description={item.email}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={state.saving}>Salvar</Button>
        </>
      )}>
      <div className="space-y-4 text-sm">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-ink p-4">
          <div><dt className="text-xs text-subtle">Recebida em</dt><dd>{formatDateTime(item.created_at)}</dd></div>
          <div><dt className="text-xs text-subtle">Conta encontrada</dt><dd>{item.user_id ? 'Sim' : 'Não / já excluída'}</dd></div>
          <div className="col-span-2"><dt className="text-xs text-subtle">Nome informado</dt><dd>{item.full_name || '—'}</dd></div>
          <div className="col-span-2"><dt className="text-xs text-subtle">Motivo</dt><dd className="whitespace-pre-wrap break-words">{item.reason || '—'}</dd></div>
          {item.user_id ? <div className="col-span-2"><dt className="text-xs text-subtle">ID do usuário</dt><dd className="break-all font-mono text-xs">{item.user_id}</dd></div> : null}
        </dl>
        <Alert tone="info" title="Como concluir">
          Confirme a titularidade pelo e-mail informado. Depois exclua o usuário em Supabase › Authentication › Users
          (os dados do banco são apagados em cascata) e marque como <strong>Concluída</strong>.
        </Alert>
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}
          options={DELETION_STATUS.map((s) => ({ value: s.key, label: s.label }))} />
        <TextArea label="Observações internas" maxLength={1000} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} hint={`${notes.length}/1000`} />
      </div>
    </Modal>
  );
}

export default function DeletionRequestsPage() {
  const [status, setStatus] = useState('open');
  const [list, setList] = useState({ items: [], loading: true, error: '', hasMore: false, nextOffset: 0, loadingMore: false });
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (offset = 0) => {
    setList((l) => ({ ...l, loading: offset === 0, loadingMore: offset > 0, error: '' }));
    try {
      const res = await listDeletionRequests({ status, offset });
      setList((l) => ({ ...res, items: offset ? [...l.items, ...res.items] : res.items, loading: false, loadingMore: false, error: '' }));
    } catch (err) {
      setList((l) => ({ ...l, loading: false, loadingMore: false, error: err.message }));
    }
  }, [status]);

  useEffect(() => {
    load(0);
  }, [load]);

  return (
    <>
      <PageHeader title="Exclusões de conta (LGPD)" description={`Solicitações recebidas por /excluir-conta. Prazo de atendimento: ${SITE.deletionDeadlineDays} dias.`} />
      <div className="mb-4"><FilterChips options={FILTERS} value={status} onChange={setStatus} label="Status das solicitações" /></div>

      {list.error ? <Alert tone="error" className="mb-4">{list.error}</Alert> : null}
      {list.loading ? <InlineLoader /> : list.items.length ? (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-subtle">
                <th className="px-5 py-3 font-semibold">Protocolo</th>
                <th className="px-5 py-3 font-semibold">E-mail</th>
                <th className="px-5 py-3 font-semibold">Recebida</th>
                <th className="px-5 py-3 font-semibold">Prazo</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((r) => {
                const open = r.status === 'pending' || r.status === 'in_progress';
                const left = daysLeft(r.created_at);
                return (
                  <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-card-2/50">
                    <td className="px-5 py-3 font-mono text-xs">{r.protocol}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{r.email}</p>
                      <p className="text-xs text-subtle">{r.user_id ? 'Conta encontrada' : 'Sem conta vinculada'}</p>
                    </td>
                    <td className="px-5 py-3 text-muted">{formatDateTime(r.created_at)}</td>
                    <td className="px-5 py-3">
                      {open ? <span className={left <= 5 ? 'font-semibold text-red-400' : 'text-muted'}>{left > 0 ? `${left} dias` : 'Vencido'}</span> : <span className="text-subtle">—</span>}
                    </td>
                    <td className="px-5 py-3"><Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="secondary" size="sm" onClick={() => setSelected(r)}><ClipboardCheck className="h-4 w-4" /> Tratar</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Inbox} title="Nenhuma solicitação neste filtro" />
      )}
      {list.hasMore ? (
        <div className="mt-4 flex justify-center"><Button variant="secondary" onClick={() => load(list.nextOffset)} loading={list.loadingMore}>Carregar mais</Button></div>
      ) : null}

      {selected ? <HandleModal item={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(0); }} /> : null}
    </>
  );
}
