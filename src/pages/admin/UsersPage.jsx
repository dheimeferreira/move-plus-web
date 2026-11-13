import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Pencil, Plus, Search, Stethoscope, Trash2, UserCog, Users } from 'lucide-react';
import { PageHeader } from './AdminLayout';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Badge, RoleBadge } from '../../components/ui/Badge';
import { FilterChips, Select, TextArea, TextInput, Toggle } from '../../components/ui/Field';
import { ConfirmModal, Modal } from '../../components/ui/Modal';
import { InlineLoader, Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/Brand';
import {
  fetchUserDetail, listProfessionals, listUsers, removeProfessional, setUserRole, upsertProfessional,
} from '../../services/adminService';
import {
  ALL_ROLES, ASSIGNABLE_ROLES, SERVICE_MODES, UFS, USER_FILTERS, WEEK_DAYS, validateProfessionalForm,
} from '../../lib/validation';
import { ROLE_LABEL, VIP_ROLES } from '../../config/site';
import { formatDate, formatNumber, formatRelative } from '../../lib/format';
import { useDebounced } from '../../lib/hooks';

// =============================================================================
// Aba: usuários
// =============================================================================
function ManageUserModal({ user, onClose, onSaved }) {
  const [detail, setDetail] = useState(null);
  const [role, setRole] = useState(user.role);
  const [state, setState] = useState({ saving: false, error: '' });

  useEffect(() => {
    let active = true;
    fetchUserDetail(user.id).then((d) => active && setDetail(d)).catch(() => active && setDetail({}));
    return () => {
      active = false;
    };
  }, [user.id]);

  const locked = user.role === 'admin';
  const losesVip = VIP_ROLES.includes(user.role) && !VIP_ROLES.includes(role);

  async function save() {
    setState({ saving: true, error: '' });
    try {
      const finalRole = await setUserRole(user.id, role);
      onSaved({ ...user, role: finalRole });
    } catch (err) {
      setState({ saving: false, error: err.message });
    }
  }

  const st = detail?.stats;
  const p = detail?.profile;
  return (
    <Modal open onClose={onClose} title={user.full_name || 'Usuário sem nome'} description={user.email} size="lg"
      footer={locked ? null : (
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={state.saving} disabled={role === user.role}>Salvar cargo</Button>
        </>
      )}>
      <div className="space-y-6">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {!detail ? <div className="flex justify-center py-6"><Spinner /></div> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Sessões', formatNumber(st?.workout_sessions ?? 0)],
              ['Sessões 30d', formatNumber(st?.sessions_30d ?? 0)],
              ['Corridas', formatNumber(st?.runs_count ?? 0)],
              ['Km', formatNumber(st?.runs_km ?? 0)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-line bg-ink p-3">
                <p className="text-lg font-semibold">{v}</p>
                <p className="text-xs text-subtle">{l}</p>
              </div>
            ))}
            <div className="col-span-2 rounded-xl border border-line bg-ink p-3 text-sm sm:col-span-4">
              <p><span className="text-subtle">Objetivo:</span> {p?.goal || '—'} • <span className="text-subtle">Cadastro:</span> {formatDate(p?.created_at)} • <span className="text-subtle">Último acesso:</span> {formatRelative(p?.last_sign_in_at)}</p>
              {p?.pathologies ? <p className="mt-1"><span className="text-subtle">Restrições declaradas:</span> {p.pathologies}</p> : null}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold">Cargo na plataforma</p>
          {locked ? (
            <Alert tone="info">O cargo <strong>admin</strong> é exclusivo da conta proprietária e não é alterado pelo painel (trava no banco).</Alert>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Cargo">
              {ALL_ROLES.map((r) => {
                const disabled = !ASSIGNABLE_ROLES.includes(r);
                return (
                  <label key={r} className={`flex items-center gap-3 rounded-xl border p-3 text-sm transition ${role === r ? 'border-brand bg-brand/10' : 'border-line'} ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:border-line-strong'}`}>
                    <input type="radio" name="role" value={r} checked={role === r} disabled={disabled} onChange={() => setRole(r)} className="accent-[#FF6B00]" />
                    <span className="flex-1 font-medium">{ROLE_LABEL[r]}</span>
                    {disabled ? <span className="text-xs text-subtle">exclusivo do proprietário</span> : null}
                  </label>
                );
              })}
            </div>
          )}
          {losesVip ? (
            <Alert tone="warn" className="mt-3">
              Atenção: no app, apenas <strong>VIP</strong> e <strong>Admin</strong> têm acesso aos recursos VIP. Este usuário perderá o protocolo ZORYX personalizado.
            </Alert>
          ) : null}
          {(role === 'personal' || role === 'nutricionista') && role !== user.role ? (
            <p className="mt-3 text-xs text-subtle">Dica: cadastre também os dados profissionais (CREF/CRN) na aba Equipe multidisciplinar.</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function UsersTab() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const debounced = useDebounced(search);
  const [list, setList] = useState({ items: [], loading: true, error: '', hasMore: false, nextOffset: 0, loadingMore: false });
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (offset = 0) => {
    setList((l) => ({ ...l, loading: offset === 0, loadingMore: offset > 0, error: '' }));
    try {
      const res = await listUsers({ search: debounced, status, offset });
      setList((l) => ({ ...res, items: offset ? [...l.items, ...res.items] : res.items, loading: false, loadingMore: false, error: '' }));
    } catch (err) {
      setList((l) => ({ ...l, loading: false, loadingMore: false, error: err.message }));
    }
  }, [debounced, status]);

  useEffect(() => {
    load(0);
  }, [load]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <input className="field pl-9" type="search" placeholder="Buscar por nome ou e-mail" value={search} maxLength={60}
            onChange={(e) => setSearch(e.target.value)} aria-label="Buscar usuários" />
        </div>
        <FilterChips options={USER_FILTERS} value={status} onChange={setStatus} label="Filtrar usuários" />
      </div>

      {list.error ? <Alert tone="error" className="mb-4">{list.error}</Alert> : null}
      {list.loading ? <InlineLoader /> : list.items.length ? (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-subtle">
                <th className="px-5 py-3 font-semibold">Usuário</th>
                <th className="px-5 py-3 font-semibold">Cargo</th>
                <th className="px-5 py-3 font-semibold">Última atividade</th>
                <th className="px-5 py-3 font-semibold">Cadastro</th>
                <th className="px-5 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((u) => (
                <tr key={u.id} className="border-b border-line/60 last:border-0 hover:bg-card-2/50">
                  <td className="px-5 py-3">
                    <p className="font-medium">{u.full_name || 'Sem nome'}</p>
                    <p className="text-xs text-subtle">{u.email}</p>
                  </td>
                  <td className="px-5 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-5 py-3 text-muted">{formatRelative(u.last_active_at)}</td>
                  <td className="px-5 py-3 text-muted">{formatDate(u.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="secondary" size="sm" onClick={() => setSelected(u)}><UserCog className="h-4 w-4" /> Gerenciar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Users} title="Nenhum usuário encontrado">Ajuste a busca ou o filtro.</EmptyState>
      )}
      {list.hasMore ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => load(list.nextOffset)} loading={list.loadingMore}>Carregar mais</Button>
        </div>
      ) : null}

      {selected ? (
        <ManageUserModal user={selected} onClose={() => setSelected(null)}
          onSaved={(u) => {
            setSelected(null);
            setList((l) => ({ ...l, items: l.items.map((x) => (x.id === u.id ? { ...x, role: u.role } : x)) }));
          }} />
      ) : null}
    </>
  );
}

// =============================================================================
// Aba: equipe multidisciplinar
// =============================================================================
const emptyForm = (kind = 'personal') => ({
  profileId: '', profileLabel: '', kind, displayName: '', councilNumber: '', councilUf: 'SP', specialty: '', bio: '',
  serviceMode: 'hibrido', availabilityDays: [], availabilityNotes: '', city: '', acceptingClients: true, isActive: true,
});

const proToForm = (p) => ({
  profileId: p.profile_id, profileLabel: `${p.profiles?.full_name || 'Usuário'} • ${p.profiles?.email || ''}`,
  kind: p.kind, displayName: p.display_name, councilNumber: p.council_number, councilUf: p.council_uf,
  specialty: p.specialty, bio: p.bio || '', serviceMode: p.service_mode, availabilityDays: p.availability_days || [],
  availabilityNotes: p.availability_notes || '', city: p.city || '', acceptingClients: p.accepting_clients, isActive: p.is_active,
});

function UserPicker({ onPick }) {
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const [res, setRes] = useState({ items: [], loading: false });

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setRes({ items: [], loading: false });
      return undefined;
    }
    let active = true;
    setRes((r) => ({ ...r, loading: true }));
    listUsers({ search: debounced, limit: 8 })
      .then((r) => active && setRes({ items: r.items.filter((u) => u.role !== 'admin'), loading: false }))
      .catch(() => active && setRes({ items: [], loading: false }));
    return () => {
      active = false;
    };
  }, [debounced]);

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium" htmlFor="pick-user">Conta do profissional no MOVE+ <span className="text-brand">*</span></label>
      <input id="pick-user" className="field" type="search" placeholder="Digite nome ou e-mail (mín. 2 letras)" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
      <p className="mt-1.5 text-xs text-subtle">O profissional precisa ter criado a conta pelo app antes.</p>
      {res.loading ? <div className="py-3"><Spinner className="h-4 w-4" /></div> : res.items.length ? (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
          {res.items.map((u) => (
            <li key={u.id}>
              <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-card-2" onClick={() => onPick(u)}>
                <span className="min-w-0"><span className="block truncate font-medium">{u.full_name || 'Sem nome'}</span><span className="block truncate text-xs text-subtle">{u.email}</span></span>
                <RoleBadge role={u.role} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ProfessionalModal({ initial, onClose, onSaved }) {
  const editing = Boolean(initial?.profileId);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ saving: false, error: '' });
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const onInput = (key) => (e) => set(key)(e.target.value);

  async function save() {
    const { errors: errs, params } = validateProfessionalForm(form);
    setErrors(errs || {});
    if (errs) return;
    setState({ saving: true, error: '' });
    try {
      await upsertProfessional(params);
      onSaved();
    } catch (err) {
      setState({ saving: false, error: err.message });
    }
  }

  const toggleDay = (day) => set('availabilityDays')(form.availabilityDays.includes(day) ? form.availabilityDays.filter((d) => d !== day) : [...form.availabilityDays, day]);
  const council = form.kind === 'nutricionista' ? 'CRN' : 'CREF';

  return (
    <Modal open onClose={onClose} size="lg" title={editing ? 'Editar profissional' : 'Cadastrar profissional'}
      description="Personal Trainers (CREF) e Nutricionistas (CRN) reais para atendimento híbrido."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={state.saving}>{editing ? 'Salvar alterações' : 'Cadastrar'}</Button>
        </>
      )}>
      <div className="space-y-5">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de profissional">
          {[['personal', 'Personal Trainer', BadgeCheck], ['nutricionista', 'Nutricionista', Stethoscope]].map(([k, label, Icon]) => (
            <button key={k} type="button" role="radio" aria-checked={form.kind === k} onClick={() => set('kind')(k)}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${form.kind === k ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:text-fg'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {form.profileId ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink px-4 py-3 text-sm">
            <span className="min-w-0 truncate">{form.profileLabel}</span>
            {!editing ? <button type="button" className="text-xs text-brand" onClick={() => setForm((f) => ({ ...f, profileId: '', profileLabel: '' }))}>Trocar</button> : null}
          </div>
        ) : (
          <>
            <UserPicker onPick={(u) => setForm((f) => ({ ...f, profileId: u.id, profileLabel: `${u.full_name || 'Sem nome'} • ${u.email}`, displayName: f.displayName || u.full_name || '' }))} />
            {errors.profileId ? <p className="text-xs text-red-400">{errors.profileId}</p> : null}
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Nome profissional" required maxLength={80} value={form.displayName} onChange={onInput('displayName')} error={errors.displayName} />
          <TextInput label="Especialidade" required maxLength={80} value={form.specialty} onChange={onInput('specialty')} error={errors.specialty}
            placeholder={form.kind === 'nutricionista' ? 'Nutrição esportiva' : 'Hipertrofia e força'} />
          <TextInput label={`Número do ${council}`} required maxLength={12} value={form.councilNumber} onChange={onInput('councilNumber')} error={errors.councilNumber}
            placeholder={form.kind === 'nutricionista' ? '12345' : '012345-G'} />
          <Select label={`UF do ${council}`} required value={form.councilUf} onChange={onInput('councilUf')} error={errors.councilUf}
            options={UFS.map((u) => ({ value: u, label: u }))} />
          <Select label="Modalidade de atendimento" value={form.serviceMode} onChange={onInput('serviceMode')} error={errors.serviceMode}
            options={SERVICE_MODES.map((m) => ({ value: m.key, label: m.label }))} />
          <TextInput label="Cidade (presencial)" maxLength={60} value={form.city} onChange={onInput('city')} placeholder="Ji-Paraná/RO" />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Dias disponíveis</p>
          <div className="flex flex-wrap gap-1.5">
            {WEEK_DAYS.map((d) => {
              const on = form.availabilityDays.includes(d.key);
              return (
                <button key={d.key} type="button" aria-pressed={on} onClick={() => toggleDay(d.key)}
                  className={`h-9 w-12 rounded-lg border text-xs font-semibold transition ${on ? 'border-brand bg-brand/15 text-brand' : 'border-line text-muted hover:text-fg'}`}>
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <TextInput label="Horários / observações" maxLength={200} value={form.availabilityNotes} onChange={onInput('availabilityNotes')} placeholder="Seg a sex, 6h–10h e 17h–21h" />
        <TextArea label="Bio" maxLength={600} rows={4} value={form.bio} onChange={onInput('bio')} error={errors.bio} hint={`${form.bio.length}/600`} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Toggle checked={form.acceptingClients} onChange={set('acceptingClients')} label="Aceitando novos alunos" />
          <Toggle checked={form.isActive} onChange={set('isActive')} label="Ativo na plataforma" description="Ao ativar, o cargo do usuário passa a ser o do profissional." />
        </div>
      </div>
    </Modal>
  );
}

function TeamTab() {
  const [state, setState] = useState({ loading: true, error: '', items: [] });
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [kind, setKind] = useState('all');

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      setState({ loading: false, error: '', items: await listProfessionals() });
    } catch (err) {
      setState({ loading: false, error: err.message, items: [] });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function confirmRemove() {
    setRemoveBusy(true);
    try {
      await removeProfessional(removing.profile_id);
      setRemoving(null);
      load();
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
      setRemoving(null);
    } finally {
      setRemoveBusy(false);
    }
  }

  const items = state.items.filter((p) => kind === 'all' || p.kind === kind);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips label="Filtrar equipe" value={kind} onChange={setKind}
          options={[{ key: 'all', label: 'Todos' }, { key: 'personal', label: 'Personal Trainers' }, { key: 'nutricionista', label: 'Nutricionistas' }]} />
        <Button onClick={() => setEditing(emptyForm(kind === 'nutricionista' ? 'nutricionista' : 'personal'))}><Plus className="h-4 w-4" /> Cadastrar profissional</Button>
      </div>
      {state.error ? <Alert tone="error" className="mb-4">{state.error}</Alert> : null}
      {state.loading ? <InlineLoader /> : items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <article key={p.id} className={`surface flex flex-col p-5 ${p.is_active ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{p.display_name}</h3>
                  <p className="truncate text-xs text-subtle">{p.profiles?.email}</p>
                </div>
                <RoleBadge role={p.kind} />
              </div>
              <p className="mt-3 text-sm"><span className="font-mono text-brand">{p.council_type} {p.council_number}/{p.council_uf}</span></p>
              <p className="mt-1 text-sm text-muted">{p.specialty}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge>{SERVICE_MODES.find((m) => m.key === p.service_mode)?.label.split(' (')[0]}</Badge>
                {p.accepting_clients ? <Badge tone="ok">Aceitando alunos</Badge> : <Badge>Agenda cheia</Badge>}
                {!p.is_active ? <Badge tone="danger">Inativo</Badge> : null}
              </div>
              {p.availability_days?.length ? (
                <p className="mt-3 text-xs text-subtle">
                  {WEEK_DAYS.filter((d) => p.availability_days.includes(d.key)).map((d) => d.label).join(' • ')}
                  {p.availability_notes ? ` — ${p.availability_notes}` : ''}
                </p>
              ) : null}
              <div className="mt-auto flex gap-2 pt-5">
                <Button variant="secondary" size="sm" onClick={() => setEditing(proToForm(p))}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                <Button variant="ghost" size="sm" onClick={() => setRemoving(p)} className="hover:!text-red-400"><Trash2 className="h-3.5 w-3.5" /> Remover</Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={Stethoscope} title="Nenhum profissional cadastrado"
          action={<Button onClick={() => setEditing(emptyForm())}><Plus className="h-4 w-4" /> Cadastrar o primeiro</Button>}>
          Cadastre Personal Trainers e Nutricionistas com registro ativo no conselho.
        </EmptyState>
      )}

      {editing ? <ProfessionalModal initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} /> : null}
      <ConfirmModal open={Boolean(removing)} onClose={() => setRemoving(null)} onConfirm={confirmRemove} loading={removeBusy}
        tone="danger" title="Remover profissional?" confirmLabel="Remover">
        <p>O cadastro profissional de <strong className="text-fg">{removing?.display_name}</strong> será apagado e o cargo do usuário volta para <strong className="text-fg">Gratuito</strong>.</p>
        <p>A conta do usuário e o histórico dele no app não são afetados.</p>
      </ConfirmModal>
    </>
  );
}

export default function UsersPage() {
  const [tab, setTab] = useState('users');
  return (
    <>
      <PageHeader title="Usuários & Equipe" description="Gerencie cargos da plataforma e a equipe multidisciplinar. Toda alteração é auditada no banco." />
      <div className="mb-6 flex gap-1 border-b border-line" role="tablist">
        {[['users', 'Usuários', Users], ['team', 'Equipe multidisciplinar', Stethoscope]].map(([key, label, Icon]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === key ? 'border-brand text-fg' : 'border-transparent text-muted hover:text-fg'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {tab === 'users' ? <UsersTab /> : <TeamTab />}
    </>
  );
}
