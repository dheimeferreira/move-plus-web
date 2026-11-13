-- =============================================================================
-- MOVE+ Web — Custos de IA (OpenAI) por funcionalidade e por usuário
-- -----------------------------------------------------------------------------
-- Pré-requisito: 2026-11-08_admin_lockdown.sql (public.is_admin()).
--
-- MODELO DE SEGURANÇA:
--   * Só as Edge Functions gravam, com a service_role (que ignora RLS). Não existe policy de
--     INSERT/UPDATE/DELETE: anon e authenticated não escrevem nem forjam custos.
--   * Leitura exclusiva do administrador: policy SELECT com public.is_admin() e a RPC
--     admin_ai_costs_summary(), cuja 1ª linha também exige is_admin().
--   * user_id vira NULL quando a conta é excluída (LGPD): o custo histórico fica, anônimo.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Falta public.is_admin(): rode 2026-11-08_admin_lockdown.sql antes.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Tabela
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  feature           text NOT NULL CHECK (feature ~ '^[a-z0-9][a-z0-9_\-/]{0,63}$'),
  model             text NOT NULL CHECK (char_length(model) BETWEEN 1 AND 100),
  prompt_tokens     integer NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens integer NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  cost_usd          numeric(14, 8) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_usage_logs IS 'Uma linha por chamada à OpenAI (usage devolvido pela API). Escrita só pelas Edge Functions (service_role).';
COMMENT ON COLUMN public.ai_usage_logs.cost_usd IS 'Custo estimado em USD a partir da tabela de preços em supabase/functions/_shared/aiUsage.js.';

CREATE INDEX IF NOT EXISTS ai_usage_logs_created_at_idx ON public.ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_logs_user_created_idx ON public.ai_usage_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_logs_feature_created_idx ON public.ai_usage_logs (feature, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. RLS: usuário comum não lê nem escreve. Admin só lê.
-- -----------------------------------------------------------------------------
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_usage_logs_admin_select ON public.ai_usage_logs;
CREATE POLICY ai_usage_logs_admin_select ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.ai_usage_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT SELECT, INSERT ON public.ai_usage_logs TO service_role;

-- -----------------------------------------------------------------------------
-- 3. RPC do painel
--   p_days NULL  -> todo o histórico; senão últimos N dias (1..3650).
--   p_limit      -> tamanho do ranking por aluno (1..200).
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_ai_costs_summary();
CREATE OR REPLACE FUNCTION public.admin_ai_costs_summary(p_days integer DEFAULT 30, p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days  integer := CASE WHEN p_days IS NULL THEN NULL ELSE least(greatest(p_days, 1), 3650) END;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_since timestamptz := CASE WHEN p_days IS NULL THEN '-infinity'::timestamptz ELSE now() - make_interval(days => least(greatest(p_days, 1), 3650)) END;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador.' USING ERRCODE = '42501';
  END IF;

  WITH logs AS (
    SELECT * FROM public.ai_usage_logs WHERE created_at >= v_since
  ),
  totals AS (
    SELECT
      count(*)                                   AS calls,
      coalesce(sum(cost_usd), 0)                 AS cost_usd,
      coalesce(sum(prompt_tokens), 0)            AS prompt_tokens,
      coalesce(sum(completion_tokens), 0)        AS completion_tokens,
      count(DISTINCT user_id)                    AS users
    FROM logs
  ),
  by_feature AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'feature', feature, 'calls', calls, 'cost_usd', cost_usd, 'users', users,
      'prompt_tokens', prompt_tokens, 'completion_tokens', completion_tokens
    ) ORDER BY cost_usd DESC), '[]'::jsonb) AS items
    FROM (
      SELECT feature, count(*) AS calls, sum(cost_usd) AS cost_usd, count(DISTINCT user_id) AS users,
             sum(prompt_tokens) AS prompt_tokens, sum(completion_tokens) AS completion_tokens
      FROM logs GROUP BY feature
    ) f
  ),
  by_model AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object('model', model, 'calls', calls, 'cost_usd', cost_usd) ORDER BY cost_usd DESC), '[]'::jsonb) AS items
    FROM (SELECT model, count(*) AS calls, sum(cost_usd) AS cost_usd FROM logs GROUP BY model) m
  ),
  daily AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'calls', calls, 'cost_usd', cost_usd) ORDER BY day), '[]'::jsonb) AS items
    FROM (
      SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, count(*) AS calls, sum(cost_usd) AS cost_usd
      FROM logs
      WHERE created_at >= now() - interval '90 days'
      GROUP BY 1
    ) d
  ),
  user_totals AS (
    SELECT user_id, count(*) AS calls, sum(cost_usd) AS cost_usd,
           sum(prompt_tokens::bigint + completion_tokens) AS tokens, max(created_at) AS last_at
    FROM logs
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    ORDER BY sum(cost_usd) DESC
    LIMIT v_limit
  ),
  user_features AS (
    SELECT f.user_id, jsonb_object_agg(f.feature, f.cost_usd) AS features
    FROM (
      SELECT user_id, feature, sum(cost_usd) AS cost_usd
      FROM logs
      WHERE user_id IN (SELECT user_id FROM user_totals)
      GROUP BY user_id, feature
    ) f
    GROUP BY f.user_id
  ),
  top_users AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'user_id', u.user_id, 'full_name', p.full_name, 'email', p.email, 'role', p.role,
      'calls', u.calls, 'cost_usd', u.cost_usd, 'tokens', u.tokens, 'last_at', u.last_at,
      'features', coalesce(uf.features, '{}'::jsonb)
    ) ORDER BY u.cost_usd DESC), '[]'::jsonb) AS items
    FROM user_totals u
    LEFT JOIN user_features uf ON uf.user_id = u.user_id
    LEFT JOIN public.profiles p ON p.id = u.user_id
  ),
  all_time AS (
    SELECT count(*) AS calls, coalesce(sum(cost_usd), 0) AS cost_usd, min(created_at) AS first_at
    FROM public.ai_usage_logs
  )
  SELECT jsonb_build_object(
    'period_days', v_days,
    'generated_at', now(),
    'totals', jsonb_build_object(
      'calls', t.calls,
      'cost_usd', t.cost_usd,
      'prompt_tokens', t.prompt_tokens,
      'completion_tokens', t.completion_tokens,
      'users', t.users,
      'avg_cost_per_call', CASE WHEN t.calls > 0 THEN t.cost_usd / t.calls ELSE 0 END,
      'avg_cost_per_user', CASE WHEN t.users > 0 THEN t.cost_usd / t.users ELSE 0 END
    ),
    'all_time', jsonb_build_object('calls', a.calls, 'cost_usd', a.cost_usd, 'first_at', a.first_at),
    'by_feature', bf.items,
    'by_model', bm.items,
    'daily', d.items,
    'top_users', tu.items
  )
  INTO v_result
  FROM totals t, all_time a, by_feature bf, by_model bm, daily d, top_users tu;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ai_costs_summary(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ai_costs_summary(integer, integer) TO authenticated;

COMMIT;
