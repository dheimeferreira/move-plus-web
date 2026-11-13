// Caminho único de dados do Painel Master Admin.
// Quem decide de verdade é o banco: public.is_admin() (role 'admin' + conta do proprietário) protege
// toda policy e é a primeira linha de cada RPC admin_*. A interface só espelha essa decisão.
import { supabase } from '../lib/supabase';
import { AppError, friendlyError } from '../lib/errors';
import {
  ASSIGNABLE_ROLES, EXERCISE_MEDIA, MUSCLE_GROUPS, PAGE_SIZE, STORE_MEDIA,
  isUuid, mediaPathFor, normalizeUserFilter, sanitizeSearchTerm, toIlikePattern, toSlug, validateUpload,
} from '../lib/validation';

const fail = (error, fallback) => {
  throw new AppError(friendlyError(error, fallback), error?.code);
};

async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) fail(error, 'Falha ao consultar o servidor.');
  return data;
}

const pageSize = (limit) => Math.min(Math.max(Number(limit) || PAGE_SIZE, 1), 50);

/** Confirma no servidor se a sessão atual é do administrador. Na dúvida, nega. */
export async function fetchIsAdmin() {
  try {
    const { data, error } = await supabase.rpc('is_admin');
    return !error && data === true;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------------
export async function fetchDashboard() {
  const [stats, pending, recent] = await Promise.all([
    rpc('admin_platform_stats'),
    supabase.from('account_deletion_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
    rpc('admin_recent_workouts', { p_before: null, p_limit: 8 }),
  ]);
  return {
    stats: stats || {},
    pendingDeletions: pending.error ? null : pending.count ?? 0,
    pendingDeletionsError: pending.error ? friendlyError(pending.error) : null,
    recentWorkouts: recent?.items || [],
  };
}

// -----------------------------------------------------------------------------
// Usuários
// -----------------------------------------------------------------------------
export async function listUsers({ search = '', status = 'all', offset = 0, limit = PAGE_SIZE } = {}) {
  const data = await rpc('admin_list_athletes', {
    p_search: sanitizeSearchTerm(search) || null,
    p_status: normalizeUserFilter(status),
    p_limit: pageSize(limit),
    p_offset: Math.max(0, offset),
  });
  return { items: data?.items || [], hasMore: Boolean(data?.has_more), nextOffset: data?.next_offset ?? offset };
}

export async function fetchUserDetail(userId) {
  if (!isUuid(userId)) throw new AppError('Usuário inválido.');
  return rpc('admin_athlete_detail', { p_user_id: userId });
}

export async function setUserRole(userId, role) {
  if (!isUuid(userId) || !ASSIGNABLE_ROLES.includes(role)) throw new AppError('Alteração de cargo inválida.');
  return rpc('admin_set_athlete_role', { p_user_id: userId, p_role: role });
}

// -----------------------------------------------------------------------------
// Equipe multidisciplinar
// -----------------------------------------------------------------------------
export async function listProfessionals() {
  const { data, error } = await supabase
    .from('professionals')
    .select('id, profile_id, kind, display_name, council_type, council_number, council_uf, specialty, bio, service_mode, availability_days, availability_notes, city, accepting_clients, is_active, created_at, updated_at, profiles(full_name, email, avatar_url, role)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) fail(error, 'Falha ao carregar a equipe.');
  return data || [];
}

/** params já validados por validateProfessionalForm. */
export const upsertProfessional = (params) => rpc('admin_upsert_professional', params);

export async function removeProfessional(profileId) {
  if (!isUuid(profileId)) throw new AppError('Profissional inválido.');
  return rpc('admin_remove_professional', { p_profile_id: profileId });
}

// -----------------------------------------------------------------------------
// Catálogo de exercícios
// -----------------------------------------------------------------------------
const EXERCISE_COLUMNS = 'id, name, slug, target_muscle, body_part, treino_key, sets, reps, rest, equipment, instructions, checklist, video_path, poster_path, media_version, measure';

export async function listExercises({ search = '', muscle = 'TODOS', offset = 0, limit = PAGE_SIZE } = {}) {
  const size = pageSize(limit);
  let query = supabase.from('exercicios').select(EXERCISE_COLUMNS).order('name', { ascending: true });
  const pattern = toIlikePattern(search);
  if (pattern) query = query.ilike('name', pattern);
  const group = MUSCLE_GROUPS.find((item) => item.key === muscle);
  // Palavras-chave fixas do código (nunca texto do usuário) dentro do filtro "or".
  if (group) query = query.or(group.keywords.map((k) => `target_muscle.ilike.*${k}*`).join(','));
  const { data, error } = await query.range(offset, offset + size);
  if (error) fail(error, 'Falha ao carregar o catálogo.');
  const rows = data || [];
  return { items: rows.slice(0, size), hasMore: rows.length > size, nextOffset: offset + Math.min(rows.length, size) };
}

export async function saveExercise(payload, id = null) {
  const query = id
    ? supabase.from('exercicios').update(payload).eq('id', id)
    : supabase.from('exercicios').insert([payload]);
  const { data, error } = await query.select('id');
  if (error) fail(error, 'Falha ao salvar o exercício.');
  // RLS que recusa a escrita devolve lista vazia, sem erro.
  if (!data?.length) throw new AppError('O banco não permitiu salvar este exercício.', '42501');
  return data[0].id;
}

export async function deleteExercise(id) {
  if (!isUuid(id)) throw new AppError('Exercício inválido.');
  const { data, error } = await supabase.from('exercicios').delete().eq('id', id).select('id');
  if (error) fail(error, 'Falha ao excluir o exercício.');
  if (!data?.length) throw new AppError('O banco não permitiu excluir este exercício.', '42501');
}

/** Envia vídeo (MP4) ou capa (WebP/JPEG) ao bucket exercise-media. Retorna o caminho gravado. */
export async function uploadExerciseMedia({ file, slug, kind, version }) {
  const allowed = kind === 'video' ? EXERCISE_MEDIA.video : EXERCISE_MEDIA.poster;
  const { mime, ext } = await validateUpload(file, allowed, EXERCISE_MEDIA.maxBytes);
  if (!toSlug(slug)) throw new AppError('Preencha o nome do exercício antes de enviar a mídia.');
  const path = mediaPathFor(slug, kind, version, ext);
  const { error } = await supabase.storage.from(EXERCISE_MEDIA.bucket).upload(path, file, { contentType: mime, upsert: true, cacheControl: '31536000' });
  if (error) fail(error, 'Falha ao enviar a mídia.');
  return path;
}

// -----------------------------------------------------------------------------
// Loja MOVE+
// -----------------------------------------------------------------------------
const PRODUCT_COLUMNS = 'id, name, slug, category, description, price_cents, stock, image_path, status, created_at, updated_at';

export async function listProducts({ status = 'all', search = '' } = {}) {
  let query = supabase.from('store_products').select(PRODUCT_COLUMNS).order('updated_at', { ascending: false }).limit(200);
  if (status === 'active' || status === 'draft') query = query.eq('status', status);
  const pattern = toIlikePattern(search);
  if (pattern) query = query.ilike('name', pattern);
  const { data, error } = await query;
  if (error) fail(error, 'Falha ao carregar os produtos.');
  return data || [];
}

export async function saveProduct(payload, id = null) {
  const query = id
    ? supabase.from('store_products').update(payload).eq('id', id)
    : supabase.from('store_products').insert([payload]);
  const { data, error } = await query.select('id');
  if (error) fail(error, 'Falha ao salvar o produto.');
  if (!data?.length) throw new AppError('O banco não permitiu salvar este produto.', '42501');
  return data[0].id;
}

export async function deleteProduct(id) {
  if (!isUuid(id)) throw new AppError('Produto inválido.');
  const { data, error } = await supabase.from('store_products').delete().eq('id', id).select('id');
  if (error) fail(error, 'Falha ao excluir o produto.');
  if (!data?.length) throw new AppError('O banco não permitiu excluir este produto.', '42501');
}

export async function uploadProductImage({ file, name }) {
  const { mime, ext } = await validateUpload(file, STORE_MEDIA.types, STORE_MEDIA.maxBytes);
  const slug = toSlug(name).slice(0, 60).replace(/-+$/, '');
  if (!slug) throw new AppError('Preencha o nome do produto antes de enviar a imagem.');
  const path = `products/${slug}/img-${Date.now().toString(36)}.${ext}`;
  const { error } = await supabase.storage.from(STORE_MEDIA.bucket).upload(path, file, { contentType: mime, upsert: false, cacheControl: '31536000' });
  if (error) fail(error, 'Falha ao enviar a imagem.');
  return path;
}

// -----------------------------------------------------------------------------
// Solicitações de exclusão de conta
// -----------------------------------------------------------------------------
export const DELETION_STATUS = Object.freeze([
  { key: 'pending', label: 'Pendente' },
  { key: 'in_progress', label: 'Em andamento' },
  { key: 'completed', label: 'Concluída' },
  { key: 'rejected', label: 'Recusada' },
]);
const DELETION_KEYS = new Set(DELETION_STATUS.map((s) => s.key));

export async function listDeletionRequests({ status = 'open', offset = 0, limit = PAGE_SIZE } = {}) {
  const size = pageSize(limit);
  let query = supabase
    .from('account_deletion_requests')
    .select('id, protocol, email, full_name, reason, user_id, source, status, admin_notes, handled_at, created_at')
    .order('created_at', { ascending: false });
  if (status === 'open') query = query.in('status', ['pending', 'in_progress']);
  else if (DELETION_KEYS.has(status)) query = query.eq('status', status);
  const { data, error } = await query.range(offset, offset + size);
  if (error) fail(error, 'Falha ao carregar as solicitações.');
  const rows = data || [];
  return { items: rows.slice(0, size), hasMore: rows.length > size, nextOffset: offset + Math.min(rows.length, size) };
}

export async function updateDeletionRequest(id, { status, adminNotes }) {
  if (!isUuid(id) || !DELETION_KEYS.has(status)) throw new AppError('Atualização inválida.');
  const notes = String(adminNotes ?? '').trim().slice(0, 1000) || null;
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .update({ status, admin_notes: notes })
    .eq('id', id)
    .select('id');
  if (error) fail(error, 'Falha ao atualizar a solicitação.');
  if (!data?.length) throw new AppError('O banco não permitiu atualizar esta solicitação.', '42501');
}
