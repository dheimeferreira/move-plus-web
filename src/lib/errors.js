// Tradução de erros do Supabase/PostgREST para mensagens seguras ao usuário.
// Nunca mostra detalhes internos (SQL, nomes de tabela) — só o texto que o próprio banco
// escreveu para o usuário (RAISE EXCEPTION em português) ou uma mensagem genérica.

const SAFE_CODES = new Set(['42501', '22023', 'PT429', 'P0001']);

export function friendlyError(error, fallback = 'Algo deu errado. Tente novamente.') {
  if (!error) return fallback;
  // AppError já nasce com texto seguro, escrito por nós.
  if (error instanceof AppError && error.message) return error.message;
  const code = error.code || error.status;
  if (code === 'PGRST202' || code === '42883' || code === '42P01' || code === 'PGRST205') {
    return 'Recurso indisponível: aplique as migrações SQL do MOVE+ Web no Supabase.';
  }
  if (code === '23505') return 'Já existe um registro com esses dados.';
  if (code === '23514') return 'Algum campo está fora do formato permitido.';
  if (code === 429 || code === '429' || code === 'PT429' || /rate limit/i.test(error.message || '')) {
    return SAFE_CODES.has(error.code) && error.message ? error.message : 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  }
  if (SAFE_CODES.has(code) && error.message) return error.message;
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(error.message || '') || error.name === 'TypeError' || error.name === 'AuthRetryableFetchError') {
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  }
  return fallback;
}

export class AppError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}
