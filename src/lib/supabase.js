// Cliente Supabase do navegador. Mesmo projeto e mesmas chaves públicas do app mobile.
// Só a chave anon/publishable entra aqui: quem protege os dados é o RLS do banco.
//
// REGRA DE OURO: este módulo NUNCA lança exceção no top-level. Um throw aqui derruba o grafo de
// módulos inteiro antes do React montar (tela preta). Configuração inválida vira `supabaseConfigError`,
// que a interface mostra de forma amigável.
import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://invalid.supabase.co';
const FALLBACK_KEY = 'invalid-key';

/**
 * Normaliza a URL do projeto. Tolera espaços, aspas, quebras de linha e valores colados com
 * sintaxe Markdown, ex.: "[https://x.supabase.co](https://x.supabase.co)" ou "<https://x.supabase.co>".
 * Devolve só a origem (https://host) ou null.
 */
export function sanitizeSupabaseUrl(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.trim().replace(/^['"`]+|['"`]+$/g, '');
  const match = text.match(/https?:\/\/[^\s\[\]()<>"'`]+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return null;
    return url.origin;
  } catch {
    return null;
  }
}

const JWT_RE = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;
const PUBLISHABLE_RE = /^sb_publishable_[\w-]+$/;

function jwtRole(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '='))).role ?? null;
  } catch {
    return null;
  }
}

/**
 * Valida a chave pública. Aceita JWT legado (eyJ...) com role anon e o formato novo
 * sb_publishable_... Recusa chaves secretas (service_role / sb_secret_): elas nunca podem ir ao navegador.
 * @returns {{ key: string|null, error: string|null }}
 */
export function sanitizeSupabaseKey(raw) {
  if (typeof raw !== 'string') return { key: null, error: 'VITE_SUPABASE_ANON_KEY ausente.' };
  const text = raw.trim().replace(/^['"`[<]+|['"`\]>]+$/g, '').replace(/\s+/g, '');
  if (!text) return { key: null, error: 'VITE_SUPABASE_ANON_KEY ausente.' };
  if (/^sb_secret_/i.test(text)) return { key: null, error: 'VITE_SUPABASE_ANON_KEY contém uma chave SECRETA (sb_secret_). Use a publishable.' };
  if (PUBLISHABLE_RE.test(text)) return { key: text, error: null };
  if (JWT_RE.test(text)) {
    const role = jwtRole(text);
    if (role === 'service_role') return { key: null, error: 'VITE_SUPABASE_ANON_KEY contém a chave service_role. Use a anon/publishable.' };
    return { key: text, error: null };
  }
  return { key: null, error: 'VITE_SUPABASE_ANON_KEY em formato desconhecido (esperado eyJ... ou sb_publishable_...).' };
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const cleanUrl = sanitizeSupabaseUrl(rawUrl);
const { key: cleanKey, error: keyError } = sanitizeSupabaseKey(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const SUPABASE_URL = cleanUrl;

/** Mensagem de configuração inválida (null quando está tudo certo). */
export const supabaseConfigError = !cleanUrl
  ? (rawUrl ? 'VITE_SUPABASE_URL inválida (esperado https://SEU-PROJETO.supabase.co).' : 'VITE_SUPABASE_URL ausente.')
  : keyError;

export const isSupabaseConfigured = !supabaseConfigError;

if (supabaseConfigError) {
  console.error(`[MOVE+] Configuração do Supabase: ${supabaseConfigError} Revise as variáveis no .env / Vercel.`);
} else if (typeof rawUrl === 'string' && rawUrl.trim() !== cleanUrl) {
  console.warn('[MOVE+] VITE_SUPABASE_URL tinha caracteres extras e foi normalizada. Corrija a variável no provedor.');
}

function buildClient() {
  const options = {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  };
  try {
    return createClient(cleanUrl || FALLBACK_URL, cleanKey || FALLBACK_KEY, options);
  } catch (err) {
    console.error('[MOVE+] Falha ao criar o cliente Supabase:', err);
    return createClient(FALLBACK_URL, FALLBACK_KEY, options);
  }
}

export const supabase = buildClient();

/** URL pública de um arquivo num bucket público (exercise-media, store-media). */
export function publicStorageUrl(bucket, path, version) {
  if (!path || !SUPABASE_URL) return null;
  const encoded = String(path).split('/').map(encodeURIComponent).join('/');
  const v = version ? `?v=${encodeURIComponent(version)}` : '';
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encoded}${v}`;
}
