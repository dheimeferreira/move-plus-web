// Cliente Supabase do navegador. Mesmo projeto e mesmas chaves públicas do app mobile.
// Só a chave anon/publishable entra aqui: quem protege os dados é o RLS do banco.
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  console.error('[MOVE+] Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env (veja .env.example).');
}

export const supabase = createClient(SUPABASE_URL || 'https://invalid.supabase.co', SUPABASE_ANON_KEY || 'invalid', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

/** URL pública de um arquivo num bucket público (exercise-media, store-media). */
export function publicStorageUrl(bucket, path, version) {
  if (!path || !SUPABASE_URL) return null;
  const encoded = String(path).split('/').map(encodeURIComponent).join('/');
  const v = version ? `?v=${encodeURIComponent(version)}` : '';
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encoded}${v}`;
}
