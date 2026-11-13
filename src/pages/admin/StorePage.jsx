import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageIcon, Package, Pencil, Plus, Search, ShoppingBag, Trash2, Upload } from 'lucide-react';
import { PageHeader } from './AdminLayout';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { FilterChips, Select, TextArea, TextInput } from '../../components/ui/Field';
import { ConfirmModal, Modal } from '../../components/ui/Modal';
import { InlineLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/Brand';
import { deleteProduct, listProducts, saveProduct, uploadProductImage } from '../../services/adminService';
import { STORE_CATEGORIES, STORE_MEDIA, categoryLabel, productToForm, validateProductForm } from '../../lib/validation';
import { publicStorageUrl } from '../../lib/supabase';
import { formatBRL, formatRelative } from '../../lib/format';
import { useDebounced } from '../../lib/hooks';

const imageUrl = (path) => publicStorageUrl(STORE_MEDIA.bucket, path);

function ProductModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState(() => productToForm(item));
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ saving: false, uploading: false, error: '' });
  const fileInput = useRef(null);
  const onInput = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setState((s) => ({ ...s, uploading: true, error: '' }));
    try {
      const path = await uploadProductImage({ file, name: form.name });
      setForm((f) => ({ ...f, imagePath: path }));
      setState((s) => ({ ...s, uploading: false }));
    } catch (err) {
      setState((s) => ({ ...s, uploading: false, error: err.message }));
    }
  }

  async function save() {
    const { errors: errs, payload } = validateProductForm(form);
    setErrors(errs || {});
    if (errs) return;
    setState((s) => ({ ...s, saving: true, error: '' }));
    try {
      await saveProduct(payload, item?.id || null);
      onSaved();
    } catch (err) {
      setState((s) => ({ ...s, saving: false, error: err.message }));
    }
  }

  const url = imageUrl(form.imagePath);
  return (
    <Modal open onClose={onClose} size="lg" title={item ? 'Editar produto' : 'Novo produto'}
      description="Itens em rascunho ficam visíveis só para o admin. Ativos aparecem na vitrine do site e da área do aluno."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={state.saving} disabled={state.uploading}>Salvar produto</Button>
        </>
      )}>
      <div className="space-y-5">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
          <div>
            <div className="aspect-square overflow-hidden rounded-xl border border-line bg-ink">
              {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-subtle"><ImageIcon className="h-8 w-8" /> Sem imagem</div>
              )}
            </div>
            <Button variant="secondary" size="sm" className="mt-2 w-full" loading={state.uploading} disabled={form.name.trim().length < 3}
              onClick={() => fileInput.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {url ? 'Trocar imagem' : 'Enviar imagem'}
            </Button>
            <input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={onFile} />
            <p className="mt-1.5 text-center text-[11px] text-subtle">JPG, PNG ou WebP • máx. 2 MB</p>
            {form.imagePath ? (
              <button type="button" className="mt-1 w-full text-center text-[11px] text-red-400 hover:underline" onClick={() => setForm((f) => ({ ...f, imagePath: '' }))}>Remover imagem</button>
            ) : null}
            {errors.imagePath ? <p className="mt-1 text-xs text-red-400">{errors.imagePath}</p> : null}
          </div>
          <div className="space-y-4">
            <TextInput label="Nome do produto" required maxLength={100} value={form.name} onChange={onInput('name')} error={errors.name} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Categoria" value={form.category} onChange={onInput('category')} error={errors.category}
                options={STORE_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} />
              <Select label="Status" value={form.status} onChange={onInput('status')}
                options={[{ value: 'draft', label: 'Rascunho' }, { value: 'active', label: 'Ativo (visível)' }]} />
              <TextInput label="Preço (R$)" required inputMode="decimal" maxLength={12} value={form.price} onChange={onInput('price')} error={errors.price} placeholder="89,90" />
              <TextInput label="Estoque" type="number" min={0} max={1000000} step={1} value={form.stock} onChange={onInput('stock')} error={errors.stock} />
            </div>
          </div>
        </div>
        <TextArea label="Descrição" maxLength={2000} rows={5} value={form.description} onChange={onInput('description')} error={errors.description}
          hint={`${form.description.length}/2000`} />
      </div>
    </Modal>
  );
}

export default function StorePage() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [state, setState] = useState({ loading: true, error: '', items: [] });
  const [editing, setEditing] = useState(undefined);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      setState({ loading: false, error: '', items: await listProducts({ status, search: debounced }) });
    } catch (err) {
      setState({ loading: false, error: err.message, items: [] });
    }
  }, [status, debounced]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    setDeleteBusy(true);
    try {
      await deleteProduct(deleting.id);
      setState((s) => ({ ...s, items: s.items.filter((x) => x.id !== deleting.id) }));
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setDeleting(null);
      setDeleteBusy(false);
    }
  }

  const active = state.items.filter((p) => p.status === 'active').length;
  return (
    <>
      <PageHeader title="Loja MOVE+" description="Catálogo da futura loja oficial (tabela store_products). Gerencie sem mexer em código."
        actions={<Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Novo produto</Button>} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips label="Status" value={status} onChange={setStatus}
          options={[{ key: 'all', label: 'Todos' }, { key: 'active', label: 'Ativos' }, { key: 'draft', label: 'Rascunhos' }]} />
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <input className="field pl-9" type="search" placeholder="Buscar produto" value={search} maxLength={60} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar produto" />
        </div>
      </div>

      {state.error ? <Alert tone="error" className="mb-4">{state.error}</Alert> : null}
      {state.loading ? <InlineLoader /> : state.items.length ? (
        <>
          <p className="mb-3 text-xs text-subtle">{state.items.length} produto(s) • {active} ativo(s) na vitrine</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {state.items.map((p) => {
              const url = imageUrl(p.image_path);
              return (
                <article key={p.id} className="surface flex overflow-hidden">
                  <div className="w-28 shrink-0 bg-ink sm:w-32">
                    {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : (
                      <div className="flex h-full items-center justify-center"><Package className="h-7 w-7 text-line-strong" /></div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand">{categoryLabel(p.category)}</p>
                      {p.status === 'active' ? <Badge tone="ok">Ativo</Badge> : <Badge>Rascunho</Badge>}
                    </div>
                    <h3 className="mt-1 line-clamp-2 font-semibold">{p.name}</h3>
                    <p className="mt-1 font-semibold">{formatBRL(p.price_cents)}</p>
                    <p className={`text-xs ${p.stock > 0 ? 'text-subtle' : 'text-red-400'}`}>{p.stock > 0 ? `${p.stock} em estoque` : 'Sem estoque'} • {formatRelative(p.updated_at)}</p>
                    <div className="mt-auto flex gap-1 pt-3">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(p)} aria-label={`Excluir ${p.name}`} className="hover:!text-red-400"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState icon={ShoppingBag} title="Nenhum produto cadastrado"
          action={<Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Cadastrar produto</Button>}>
          Monte o catálogo agora e ative os itens quando a loja abrir.
        </EmptyState>
      )}

      {editing !== undefined ? <ProductModal item={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} /> : null}
      <ConfirmModal open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={confirmDelete} loading={deleteBusy}
        tone="danger" title="Excluir produto?" confirmLabel="Excluir">
        <p><strong className="text-fg">{deleting?.name}</strong> será removido do catálogo. Prefira “Rascunho” se quiser apenas ocultá-lo.</p>
      </ConfirmModal>
    </>
  );
}
