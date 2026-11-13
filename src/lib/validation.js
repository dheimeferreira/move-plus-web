// Validação estrita das entradas (portada de ../move-plus/src/utils/adminValidation.js e workoutSets.js).
// O banco revalida tudo (CHECKs, RLS, RPCs); isto aqui é a primeira barreira e o feedback de UX.

export const SEARCH_MAX_LENGTH = 60;
export const PAGE_SIZE = 20;

const isInvisible = (code) =>
  code < 0x20 || (code >= 0x7f && code <= 0x9f) || (code >= 0x200b && code <= 0x200f) ||
  (code >= 0x2028 && code <= 0x202e) || (code >= 0x2060 && code <= 0x206f) || code === 0xfeff;

/** Uma linha de texto: sem caracteres invisíveis, espaços colapsados, tamanho limitado. */
export function cleanLine(text, max = 200) {
  return Array.from(String(text ?? ''), (char) => (isInvisible(char.codePointAt(0)) ? ' ' : char))
    .join('')
    .split(' ')
    .filter(Boolean)
    .join(' ')
    .slice(0, max)
    .trim();
}

/** Texto multilinha: remove invisíveis exceto quebra de linha. */
export function cleanMultiline(text, max = 2000) {
  return Array.from(String(text ?? ''), (char) => {
    const code = char.codePointAt(0);
    return code === 10 ? char : isInvisible(code) ? ' ' : char;
  })
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export const sanitizeSearchTerm = (text) => cleanLine(text, SEARCH_MAX_LENGTH);

const BACKSLASH = String.fromCharCode(92);
/** Padrão literal para .ilike(): escapa \ % _ (o termo nunca vira curinga). */
export function toIlikePattern(text) {
  const term = sanitizeSearchTerm(text);
  if (!term) return null;
  const escaped = Array.from(term, (c) => (c === BACKSLASH || c === '%' || c === '_' ? BACKSLASH + c : c)).join('');
  return `%${escaped}%`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value) => typeof value === 'string' && UUID_PATTERN.test(value);

const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
export const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();
export const isValidEmail = (value) => {
  const email = normalizeEmail(value);
  return email.length >= 6 && email.length <= 254 && EMAIL_PATTERN.test(email);
};

/** Mesma regra de toExerciseSlug do app (o slug liga exercício, mídia e checklist). */
export const toSlug = (name = '') =>
  String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// -----------------------------------------------------------------------------
// Papéis e filtros de usuários
// -----------------------------------------------------------------------------
export const ASSIGNABLE_ROLES = Object.freeze(['user', 'vip', 'personal', 'nutricionista']);
export const ALL_ROLES = Object.freeze([...ASSIGNABLE_ROLES, 'admin']);

export const USER_FILTERS = Object.freeze([
  { key: 'all', label: 'Todos' },
  { key: 'free', label: 'Gratuito' },
  { key: 'vip', label: 'VIP' },
  { key: 'team', label: 'Equipe' },
  { key: 'personal', label: 'Personal' },
  { key: 'nutricionista', label: 'Nutricionista' },
  { key: 'active', label: 'Ativos 7d' },
  { key: 'inactive', label: 'Inativos 30d' },
  { key: 'pathology', label: 'Com restrição' },
]);
const FILTER_KEYS = new Set(USER_FILTERS.map((f) => f.key));
export const normalizeUserFilter = (key) => (FILTER_KEYS.has(key) ? key : 'all');

// -----------------------------------------------------------------------------
// Profissionais (CREF / CRN)
// -----------------------------------------------------------------------------
export const UFS = Object.freeze(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']);
export const WEEK_DAYS = Object.freeze([
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' }, { key: 'dom', label: 'Dom' },
]);
export const SERVICE_MODES = Object.freeze([
  { key: 'hibrido', label: 'Híbrido (online + presencial)' },
  { key: 'online', label: 'Somente online' },
  { key: 'presencial', label: 'Somente presencial' },
]);
const COUNCIL_PATTERN = /^[0-9]{3,6}(-[GP])?(\/P)?$/;

export function validateProfessionalForm(form) {
  const errors = {};
  const kind = form?.kind === 'nutricionista' || form?.kind === 'personal' ? form.kind : null;
  if (!kind) errors.kind = 'Escolha o tipo de profissional.';
  if (!isUuid(form?.profileId)) errors.profileId = 'Selecione a conta do profissional.';
  const displayName = cleanLine(form?.displayName, 81);
  if (displayName.length < 3 || displayName.length > 80) errors.displayName = 'Nome profissional entre 3 e 80 caracteres.';
  const councilNumber = String(form?.councilNumber ?? '').replace(/\s/g, '').toUpperCase();
  if (!COUNCIL_PATTERN.test(councilNumber)) {
    errors.councilNumber = kind === 'nutricionista' ? 'Formato do CRN: 12345' : 'Formato do CREF: 012345-G';
  }
  const councilUf = String(form?.councilUf ?? '').toUpperCase();
  if (!UFS.includes(councilUf)) errors.councilUf = 'Selecione a UF do conselho.';
  const specialty = cleanLine(form?.specialty, 81);
  if (specialty.length < 3 || specialty.length > 80) errors.specialty = 'Especialidade entre 3 e 80 caracteres.';
  const bio = cleanMultiline(form?.bio, 601);
  if (bio.length > 600) errors.bio = 'Bio com até 600 caracteres.';
  const serviceMode = SERVICE_MODES.some((m) => m.key === form?.serviceMode) ? form.serviceMode : null;
  if (!serviceMode) errors.serviceMode = 'Escolha a modalidade de atendimento.';
  const days = Array.isArray(form?.availabilityDays) ? form.availabilityDays.filter((d) => WEEK_DAYS.some((w) => w.key === d)) : [];
  const notes = cleanLine(form?.availabilityNotes, 200);
  const city = cleanLine(form?.city, 60);

  if (Object.keys(errors).length) return { errors };
  return {
    params: {
      p_profile_id: form.profileId,
      p_kind: kind,
      p_display_name: displayName,
      p_council_number: councilNumber,
      p_council_uf: councilUf,
      p_specialty: specialty,
      p_bio: bio || null,
      p_service_mode: serviceMode,
      p_availability_days: [...new Set(days)],
      p_availability_notes: notes || null,
      p_city: city || null,
      p_accepting_clients: Boolean(form.acceptingClients),
      p_is_active: Boolean(form.isActive),
    },
  };
}

// -----------------------------------------------------------------------------
// Catálogo de exercícios (mesmas regras do painel mobile)
// -----------------------------------------------------------------------------
export const MUSCLE_GROUPS = Object.freeze([
  { key: 'Peitoral', keywords: ['peitoral'] },
  { key: 'Costas', keywords: ['costas', 'dorsal', 'dorso'] },
  { key: 'Pernas', keywords: ['perna', 'quadriceps', 'gluteo', 'coxa', 'isquiotibiais', 'panturrilha', 'gastrocnemio'] },
  { key: 'Ombros', keywords: ['ombro', 'deltoide', 'trapezio'] },
  { key: 'Braços', keywords: ['biceps', 'triceps', 'braquial', 'antebraco', 'braco'] },
  { key: 'Abdômen', keywords: ['abdom', 'core', 'obliquo'] },
  { key: 'Cardio', keywords: ['cardio'] },
]);

export const MODE_TO_BODY_PART = Object.freeze({ GYM: 'Academia', HOME: 'Calistenia' });
export const bodyPartToMode = (bodyPart) => (bodyPart === 'Calistenia' ? 'HOME' : 'GYM');
export const TREINO_KEYS = Object.freeze({ GYM: ['A', 'B', 'C', 'D', 'E'], HOME: ['H1', 'H2', 'H3', 'H4'] });

export const EXERCISE_LIMITS = Object.freeze({
  name: { min: 3, max: 80 },
  muscle: { max: 60 },
  equipment: { max: 60 },
  instructions: { max: 600 },
  rest: { min: 0, max: 600, step: 15 },
  checklistItems: 8,
  checklistItemLength: 120,
});

// Bucket exercise-media: 3 MB, video/mp4, image/webp, image/jpeg (ver 2026-11-07_workout_media_sessions.sql)
export const EXERCISE_MEDIA = Object.freeze({
  bucket: 'exercise-media',
  maxBytes: 3 * 1024 * 1024,
  video: { 'video/mp4': 'mp4' },
  poster: { 'image/webp': 'webp', 'image/jpeg': 'jpg' },
});

const MEDIA_PATH_PATTERN = /^exercises\/[a-z0-9-]+\/[A-Za-z0-9._-]+\.(mp4|mov|webm|jpg|jpeg|png|webp)$/;
const REPS_PATTERN = /^([0-9]{1,3}(\s?(-|a)\s?[0-9]{1,3})?\s?(reps|s|seg|min)?|[0-9]{1,3}\s?(s|seg|min)(\s?(-|a)\s?[0-9]{1,3}\s?(s|seg|min))?)$/i;
const SECONDS_PATTERN = /\d\s*(s|seg)\b/i;
const PLAIN_RANGE_PATTERN = /^\s*\d+(\s*-\s*\d+)?\s*$/;
const TIME_BY_NAME_PATTERN = /prancha|plank/i;

export function resolveMeasure({ measure, name = '', reps = '' } = {}) {
  if (measure === 'time' || measure === 'reps') return measure;
  if (SECONDS_PATTERN.test(String(reps))) return 'time';
  if (TIME_BY_NAME_PATTERN.test(name) && PLAIN_RANGE_PATTERN.test(String(reps))) return 'time';
  return 'reps';
}

export const isValidMediaPath = (value) => !value || MEDIA_PATH_PATTERN.test(String(value).trim());

/** Caminho versionado: trocar o arquivo muda a URL e invalida o cache do app. */
export function mediaPathFor(slug, kind, version, ext) {
  const safeSlug = toSlug(slug);
  const v = Math.max(1, Math.round(Number(version) || 1));
  const extension = String(ext || (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '');
  return kind === 'video' ? `exercises/${safeSlug}/v${v}.${extension}` : `exercises/${safeSlug}/poster-v${v}.${extension}`;
}

export function parseChecklist(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => cleanLine(line.replace(/^[-•*]\s*/, ''), EXERCISE_LIMITS.checklistItemLength))
    .filter(Boolean)
    .slice(0, EXERCISE_LIMITS.checklistItems);
}

export function exerciseToForm(item) {
  const mode = bodyPartToMode(item?.body_part);
  const sets = parseInt(String(item?.sets ?? ''), 10);
  return {
    name: item?.name || '',
    muscle: item?.target_muscle || '',
    mode,
    treinoKey: item?.treino_key && TREINO_KEYS[mode].includes(item.treino_key) ? item.treino_key : TREINO_KEYS[mode][0],
    sets: Number.isFinite(sets) ? sets : 4,
    reps: String(item?.reps || '10-12').replace(/\s?reps$/i, ''),
    rest: Number.isFinite(Number(item?.rest)) && item?.rest !== null ? Number(item.rest) : 60,
    equipment: item?.equipment || '',
    instructions: item?.instructions || '',
    checklist: Array.isArray(item?.checklist) ? item.checklist.join('\n') : '',
    videoPath: item?.video_path || '',
    posterPath: item?.poster_path || '',
    mediaVersion: Math.max(1, Number(item?.media_version) || 1),
  };
}

export function validateExerciseForm(form) {
  const errors = {};
  const name = cleanLine(form?.name, EXERCISE_LIMITS.name.max + 1);
  if (name.length < EXERCISE_LIMITS.name.min) errors.name = `Nome com pelo menos ${EXERCISE_LIMITS.name.min} letras.`;
  else if (name.length > EXERCISE_LIMITS.name.max) errors.name = `Nome com até ${EXERCISE_LIMITS.name.max} caracteres.`;
  const slug = toSlug(name);
  if (!errors.name && !slug) errors.name = 'Use letras ou números no nome.';

  const mode = form?.mode === 'HOME' ? 'HOME' : 'GYM';
  if (!TREINO_KEYS[mode].includes(form?.treinoKey)) errors.treinoKey = 'Escolha a ficha.';

  const sets = Number(form?.sets);
  if (!Number.isInteger(sets) || sets < 1 || sets > 10) errors.sets = 'Séries entre 1 e 10.';

  const reps = cleanLine(form?.reps, 20);
  if (!REPS_PATTERN.test(reps)) errors.reps = 'Use "10-12", "8 a 10" ou "30s".';

  const rest = Number(form?.rest);
  const { min, max, step } = EXERCISE_LIMITS.rest;
  if (!Number.isInteger(rest) || rest < min || rest > max || rest % step !== 0) errors.rest = `Descanso de ${min} a ${max} s, em passos de ${step}.`;

  const videoPath = String(form?.videoPath ?? '').trim();
  const posterPath = String(form?.posterPath ?? '').trim();
  if (!isValidMediaPath(videoPath)) errors.videoPath = 'Caminho no bucket (ex.: exercises/supino-reto/v1.mp4), sem link externo.';
  if (!isValidMediaPath(posterPath)) errors.posterPath = 'Caminho no bucket (ex.: exercises/supino-reto/poster-v1.jpg).';

  if (Object.keys(errors).length) return { errors };

  const repsText = /^[0-9]{1,3}(\s?(-|a)\s?[0-9]{1,3})?$/.test(reps) ? `${reps.replace(/\s?a\s?/, '-')} reps` : reps;
  return {
    payload: {
      name,
      slug,
      measure: resolveMeasure({ name, reps }),
      target_muscle: cleanLine(form?.muscle, EXERCISE_LIMITS.muscle.max) || null,
      body_part: MODE_TO_BODY_PART[mode],
      treino_key: form.treinoKey,
      sets: `${sets} séries`,
      reps: repsText,
      rest,
      equipment: cleanLine(form?.equipment, EXERCISE_LIMITS.equipment.max) || null,
      instructions: String(form?.instructions ?? '').trim().slice(0, EXERCISE_LIMITS.instructions.max) || null,
      checklist: parseChecklist(form?.checklist),
      video_path: videoPath || null,
      poster_path: posterPath || null,
      media_version: Math.max(1, Math.round(Number(form?.mediaVersion) || 1)),
    },
  };
}

// -----------------------------------------------------------------------------
// Loja
// -----------------------------------------------------------------------------
export const STORE_CATEGORIES = Object.freeze([
  { key: 'suplementos', label: 'Suplementos' },
  { key: 'vestuario', label: 'Vestuário' },
  { key: 'acessorios', label: 'Acessórios' },
  { key: 'equipamentos', label: 'Equipamentos' },
  { key: 'programas', label: 'Programas digitais' },
]);
export const categoryLabel = (key) => STORE_CATEGORIES.find((c) => c.key === key)?.label || key;

export const STORE_MEDIA = Object.freeze({
  bucket: 'store-media',
  maxBytes: 2 * 1024 * 1024,
  types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
});
const STORE_IMAGE_PATTERN = /^products\/[a-z0-9-]+\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/;

/** "89,90" | "1.299,00" | "89.9" → centavos inteiros, ou null. */
export function parsePriceToCents(input) {
  const raw = String(input ?? '').trim().replace(/[R$\s]/g, '');
  if (!raw) return null;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export const centsToInput = (cents) =>
  Number.isFinite(Number(cents)) ? (Number(cents) / 100).toFixed(2).replace('.', ',') : '';

export function productToForm(item) {
  return {
    name: item?.name || '',
    category: item?.category || 'suplementos',
    description: item?.description || '',
    price: item ? centsToInput(item.price_cents) : '',
    stock: item?.stock ?? 0,
    imagePath: item?.image_path || '',
    status: item?.status === 'active' ? 'active' : 'draft',
  };
}

export function validateProductForm(form) {
  const errors = {};
  const name = cleanLine(form?.name, 101);
  if (name.length < 3 || name.length > 100) errors.name = 'Nome entre 3 e 100 caracteres.';
  const slug = toSlug(name).slice(0, 100).replace(/-+$/, '');
  if (!errors.name && !slug) errors.name = 'Use letras ou números no nome.';
  if (!STORE_CATEGORIES.some((c) => c.key === form?.category)) errors.category = 'Escolha a categoria.';
  const description = cleanMultiline(form?.description, 2001);
  if (description.length > 2000) errors.description = 'Descrição com até 2000 caracteres.';
  const priceCents = parsePriceToCents(form?.price);
  if (priceCents === null || priceCents > 10000000) errors.price = 'Preço inválido (ex.: 89,90).';
  const stock = Number(form?.stock);
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) errors.stock = 'Estoque deve ser um número inteiro ≥ 0.';
  const imagePath = String(form?.imagePath ?? '').trim();
  if (imagePath && !STORE_IMAGE_PATTERN.test(imagePath)) errors.imagePath = 'Imagem inválida: envie um arquivo.';
  const status = form?.status === 'active' ? 'active' : 'draft';

  if (Object.keys(errors).length) return { errors };
  return {
    payload: {
      name, slug, category: form.category, description: description || null,
      price_cents: priceCents, stock, image_path: imagePath || null, status,
    },
  };
}

// -----------------------------------------------------------------------------
// Upload: confere o tipo real pelos primeiros bytes (não confia na extensão nem no MIME do navegador)
// -----------------------------------------------------------------------------
export async function sniffFileType(file) {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from, to) => String.fromCharCode(...head.slice(from, to));
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp') return 'video/mp4';
  return null;
}

/** Valida um arquivo contra tipos permitidos { mime: ext } e tamanho máximo. Retorna { mime, ext } ou lança. */
export async function validateUpload(file, allowed, maxBytes) {
  if (!(file instanceof File) || !file.size) throw new Error('Selecione um arquivo válido.');
  if (file.size > maxBytes) throw new Error(`Arquivo grande demais (máximo de ${(maxBytes / 1024 / 1024).toFixed(0)} MB).`);
  const mime = await sniffFileType(file);
  if (!mime || !allowed[mime]) throw new Error(`Formato não permitido. Use: ${Object.values(allowed).join(', ').toUpperCase()}.`);
  return { mime, ext: allowed[mime] };
}
