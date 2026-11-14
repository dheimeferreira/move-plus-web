// Dados da Área do Aluno: tudo lido com o token do próprio usuário (RLS do app mobile vale aqui).
import { supabase } from '../lib/supabase';
import { AppError, friendlyError } from '../lib/errors';
import { isValidEmail, normalizeEmail, cleanLine, cleanMultiline } from '../lib/validation';

const PROFILE_COLUMNS = 'id, full_name, avatar_url, role, goal, level, gender, age, height, current_weight, target_weight, initial_weight, workout_location, weekly_frequency, onboarding_completed, total_km, streak, created_at';

export async function fetchOwnProfile(userId) {
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle();
  if (error) throw new AppError(friendlyError(error, 'Não foi possível carregar seu perfil.'), error.code);
  return data;
}

/** Estatísticas reais dos logs (RPC profile_stats, SECURITY INVOKER). */
export async function fetchOwnStats() {
  const offset = -new Date().getTimezoneOffset();
  const { data, error } = await supabase.rpc('profile_stats', { p_tz_offset_minutes: offset });
  if (error) return null;
  return data;
}

/** Plano VIP do usuário (RPC my_entitlement: role, assinatura da Google Play ou trial de 7 dias). */
export async function fetchEntitlement() {
  const { data, error } = await supabase.rpc('my_entitlement');
  if (error) return null; // banco sem a migração 2026-11-13: a página usa o role
  return data;
}

export async function fetchActivePlan(userId) {
  const { data, error } = await supabase
    .from('user_ai_custom_workouts')
    .select('id, title, goal, level, weekly_frequency, location, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

/** Últimas séries agrupadas em sessões (session_id; séries antigas sem id agrupam por dia). */
export async function fetchRecentSessions(userId, maxSessions = 6) {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('session_id, exercise_name, weight_kg, reps, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return [];
  const sessions = new Map();
  for (const row of data || []) {
    const key = row.session_id || `dia-${String(row.created_at).slice(0, 10)}`;
    if (!sessions.has(key)) {
      if (sessions.size >= maxSessions) continue;
      sessions.set(key, { key, lastAt: row.created_at, sets: 0, volume: 0, exercises: new Set() });
    }
    const s = sessions.get(key);
    s.sets += 1;
    if (row.weight_kg > 0 && row.reps > 0) s.volume += Number(row.weight_kg) * Number(row.reps);
    if (row.exercise_name) s.exercises.add(row.exercise_name);
  }
  return [...sessions.values()].map((s) => ({ ...s, volume: Math.round(s.volume), exercises: [...s.exercises] }));
}

export async function fetchActiveProducts(limit = 6) {
  const { data, error } = await supabase
    .from('store_products')
    .select('id, name, category, description, price_cents, stock, image_path')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

/** Formulário público de /excluir-conta (RPC com validação e rate limit no banco). */
export async function requestAccountDeletion({ email, fullName, reason }) {
  if (!isValidEmail(email)) throw new AppError('Informe um e-mail válido.');
  const { data, error } = await supabase.rpc('request_account_deletion', {
    p_email: normalizeEmail(email),
    p_full_name: cleanLine(fullName, 100) || null,
    p_reason: cleanMultiline(reason, 500) || null,
  });
  if (error) throw new AppError(friendlyError(error, 'Não foi possível registrar sua solicitação agora.'), error.code);
  return data;
}
