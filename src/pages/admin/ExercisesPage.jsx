import { useCallback, useEffect, useRef, useState } from 'react';
import { Dumbbell, Film, ImageIcon, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { PageHeader } from './AdminLayout';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { FilterChips, Select, TextArea, TextInput } from '../../components/ui/Field';
import { ConfirmModal, Modal } from '../../components/ui/Modal';
import { InlineLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/Brand';
import { deleteExercise, listExercises, saveExercise, uploadExerciseMedia } from '../../services/adminService';
import { EXERCISE_MEDIA, MUSCLE_GROUPS, TREINO_KEYS, exerciseToForm, toSlug, validateExerciseForm } from '../../lib/validation';
import { publicStorageUrl } from '../../lib/supabase';
import { useDebounced } from '../../lib/hooks';

const MUSCLE_FILTERS = [{ key: 'TODOS', label: 'Todos' }, ...MUSCLE_GROUPS.map((g) => ({ key: g.key, label: g.key }))];
const mediaUrl = (path, version) => publicStorageUrl(EXERCISE_MEDIA.bucket, path, version);

function MediaField({ kind, path, version, slug, onUploaded }) {
  const input = useRef(null);
  const [state, setState] = useState({ busy: false, error: '' });
  const isVideo = kind === 'video';
  const url = mediaUrl(path, version);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setState({ busy: true, error: '' });
    try {
      onUploaded(await uploadExerciseMedia({ file, slug, kind, version }));
      setState({ busy: false, error: '' });
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  }

  return (
    <div className="rounded-xl border border-line bg-ink p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          {isVideo ? <Film className="h-4 w-4 text-brand" /> : <ImageIcon className="h-4 w-4 text-brand" />}
          {isVideo ? 'Vídeo demonstrativo' : 'Capa (poster)'}
        </p>
        <Button variant="secondary" size="sm" onClick={() => input.current?.click()} loading={state.busy} disabled={!toSlug(slug)}>
          <Upload className="h-3.5 w-3.5" /> Enviar
        </Button>
        <input ref={input} type="file" hidden accept={isVideo ? 'video/mp4' : 'image/webp,image/jpeg'} onChange={onFile} />
      </div>
      <div className="mt-3 aspect-video overflow-hidden rounded-lg border border-line bg-card">
        {url ? (
          isVideo ? <video src={url} className="h-full w-full object-cover" muted loop autoPlay playsInline controls={false} /> : <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-subtle">Sem {isVideo ? 'vídeo' : 'capa'}</div>
        )}
      </div>
      <p className="mt-2 truncate font-mono text-[11px] text-subtle" title={path}>{path || '—'}</p>
      <p className="text-[11px] text-subtle">{isVideo ? 'MP4 H.264 sem áudio, 5–10 s em loop' : 'WebP ou JPEG'} • máx. 3 MB</p>
      {state.error ? <p className="mt-1 text-xs text-red-400">{state.error}</p> : null}
    </div>
  );
}

function ExerciseModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState(() => exerciseToForm(item));
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ saving: false, error: '' });
  const onInput = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const setMode = (mode) => setForm((f) => ({ ...f, mode, treinoKey: TREINO_KEYS[mode][0] }));

  async function save() {
    const { errors: errs, payload } = validateExerciseForm(form);
    setErrors(errs || {});
    if (errs) return;
    setState({ saving: true, error: '' });
    try {
      await saveExercise(payload, item?.id || null);
      onSaved();
    } catch (err) {
      setState({ saving: false, error: err.message });
    }
  }

  // Trocar a mídia sobe a versão: a URL muda e o cache do app é invalidado.
  const onUploaded = (kind) => (path) =>
    setForm((f) => ({ ...f, [kind === 'video' ? 'videoPath' : 'posterPath']: path }));
  const bumpVersion = () => setForm((f) => ({ ...f, mediaVersion: f.mediaVersion + 1 }));

  return (
    <Modal open onClose={onClose} size="lg" title={item ? 'Editar exercício' : 'Novo exercício'}
      description="Mesmas regras do painel do app. O slug liga o exercício à mídia e ao checklist."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={state.saving}>Salvar</Button>
        </>
      )}>
      <div className="space-y-5">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Nome" required maxLength={80} value={form.name} onChange={onInput('name')} error={errors.name}
            hint={toSlug(form.name) ? `slug: ${toSlug(form.name)}` : undefined} />
          <TextInput label="Grupo muscular alvo" maxLength={60} value={form.muscle} onChange={onInput('muscle')} placeholder="Peitoral, tríceps" />
          <Select label="Modalidade" value={form.mode} onChange={(e) => setMode(e.target.value)}
            options={[{ value: 'GYM', label: 'Academia' }, { value: 'HOME', label: 'Calistenia / casa' }]} />
          <Select label="Ficha" value={form.treinoKey} onChange={onInput('treinoKey')} error={errors.treinoKey}
            options={TREINO_KEYS[form.mode].map((k) => ({ value: k, label: `Treino ${k}` }))} />
          <TextInput label="Séries" type="number" min={1} max={10} value={form.sets} onChange={onInput('sets')} error={errors.sets} />
          <TextInput label="Repetições" maxLength={20} value={form.reps} onChange={onInput('reps')} error={errors.reps} placeholder="10-12 ou 30s" />
          <TextInput label="Descanso (s)" type="number" min={0} max={600} step={15} value={form.rest} onChange={onInput('rest')} error={errors.rest} />
          <TextInput label="Equipamento" maxLength={60} value={form.equipment} onChange={onInput('equipment')} placeholder="Barra, banco" />
        </div>
        <TextArea label="Instruções" maxLength={600} rows={3} value={form.instructions} onChange={onInput('instructions')} hint={`${form.instructions.length}/600`} />
        <TextArea label="Checklist de biomecânica" rows={4} value={form.checklist} onChange={onInput('checklist')}
          hint="Uma dica por linha (até 8 dicas de 120 caracteres)." />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Mídia (bucket exercise-media)</p>
            <button type="button" className="text-xs text-brand" onClick={bumpVersion}>Versão v{form.mediaVersion} • nova versão</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MediaField kind="video" path={form.videoPath} version={form.mediaVersion} slug={form.name} onUploaded={onUploaded('video')} />
            <MediaField kind="poster" path={form.posterPath} version={form.mediaVersion} slug={form.name} onUploaded={onUploaded('poster')} />
          </div>
          {errors.videoPath || errors.posterPath ? <p className="mt-2 text-xs text-red-400">{errors.videoPath || errors.posterPath}</p> : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TextInput label="Caminho do vídeo" maxLength={160} value={form.videoPath} onChange={onInput('videoPath')} placeholder="exercises/supino-reto/v1.mp4" />
            <TextInput label="Caminho da capa" maxLength={160} value={form.posterPath} onChange={onInput('posterPath')} placeholder="exercises/supino-reto/poster-v1.webp" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function ExercisesPage() {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('TODOS');
  const debounced = useDebounced(search);
  const [list, setList] = useState({ items: [], loading: true, error: '', hasMore: false, nextOffset: 0, loadingMore: false });
  const [editing, setEditing] = useState(undefined);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async (offset = 0) => {
    setList((l) => ({ ...l, loading: offset === 0, loadingMore: offset > 0, error: '' }));
    try {
      const res = await listExercises({ search: debounced, muscle, offset });
      setList((l) => ({ ...res, items: offset ? [...l.items, ...res.items] : res.items, loading: false, loadingMore: false, error: '' }));
    } catch (err) {
      setList((l) => ({ ...l, loading: false, loadingMore: false, error: err.message }));
    }
  }, [debounced, muscle]);

  useEffect(() => {
    load(0);
  }, [load]);

  async function confirmDelete() {
    setDeleteBusy(true);
    try {
      await deleteExercise(deleting.id);
      setList((l) => ({ ...l, items: l.items.filter((x) => x.id !== deleting.id) }));
      setDeleting(null);
    } catch (err) {
      setList((l) => ({ ...l, error: err.message }));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Catálogo de exercícios" description="Tabela exercicios + vídeos demonstrativos no bucket exercise-media. Alterações aparecem no app imediatamente."
        actions={<Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Novo exercício</Button>} />

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <input className="field pl-9" type="search" placeholder="Buscar exercício" value={search} maxLength={60} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar exercício" />
        </div>
        <FilterChips options={MUSCLE_FILTERS} value={muscle} onChange={setMuscle} label="Grupo muscular" />
      </div>

      {list.error ? <Alert tone="error" className="mb-4">{list.error}</Alert> : null}
      {list.loading ? <InlineLoader /> : list.items.length ? (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-subtle">
                <th className="px-5 py-3 font-semibold">Exercício</th>
                <th className="px-5 py-3 font-semibold">Grupo muscular</th>
                <th className="px-5 py-3 font-semibold">Ficha</th>
                <th className="px-5 py-3 font-semibold">Prescrição</th>
                <th className="px-5 py-3 font-semibold">Mídia</th>
                <th className="px-5 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((ex) => (
                <tr key={ex.id} className="border-b border-line/60 last:border-0 hover:bg-card-2/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-14 shrink-0 overflow-hidden rounded-md border border-line bg-ink">
                        {ex.poster_path ? <img src={mediaUrl(ex.poster_path, ex.media_version)} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{ex.name}</p>
                        <p className="font-mono text-[11px] text-subtle">{ex.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted">{ex.target_muscle || '—'}</td>
                  <td className="px-5 py-3"><Badge>{ex.body_part === 'Calistenia' ? 'Casa' : 'Academia'} • {ex.treino_key || '—'}</Badge></td>
                  <td className="px-5 py-3 text-muted">{ex.sets} • {ex.reps} • {ex.rest ?? 0}s</td>
                  <td className="px-5 py-3">{ex.video_path ? <Badge tone="ok">Vídeo v{ex.media_version || 1}</Badge> : <Badge tone="warn">Sem vídeo</Badge>}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(ex)} aria-label={`Editar ${ex.name}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(ex)} aria-label={`Excluir ${ex.name}`} className="hover:!text-red-400"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Dumbbell} title="Nenhum exercício encontrado">Ajuste a busca ou cadastre um novo exercício.</EmptyState>
      )}
      {list.hasMore ? (
        <div className="mt-4 flex justify-center"><Button variant="secondary" onClick={() => load(list.nextOffset)} loading={list.loadingMore}>Carregar mais</Button></div>
      ) : null}

      {editing !== undefined ? <ExerciseModal item={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(0); }} /> : null}
      <ConfirmModal open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={confirmDelete} loading={deleteBusy}
        tone="danger" title="Excluir exercício?" confirmLabel="Excluir">
        <p><strong className="text-fg">{deleting?.name}</strong> deixará de aparecer no catálogo do app.</p>
        <p>Os registros de treino já feitos pelos atletas são mantidos. Os arquivos de mídia no bucket não são apagados.</p>
      </ConfirmModal>
    </>
  );
}
