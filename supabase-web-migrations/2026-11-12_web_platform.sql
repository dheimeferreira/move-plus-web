-- =============================================================================
-- MOVE+ Web | Papéis da equipe, profissionais, loja e solicitações de exclusão
-- Data: 2026-11-12
-- Executar no Supabase Dashboard > SQL Editor (rodar o arquivo inteiro de uma vez).
-- Idempotente: pode ser rodado de novo sem efeito colateral.
--
-- PRÉ-REQUISITOS (migrações do app mobile em ../move-plus/supabase/sql):
--   * 2026-11-08_admin_lockdown.sql     -> is_admin() + trava guard_admin_role
--   * 2026-11-10_profile_security_stats -> protect_profile_columns (role imutável pelo cliente)
--   * 2026-11-11_admin_hub.sql          -> admin_audit_log, admin_list_athletes, admin_set_athlete_role
--   O bloco 0 aborta a transação inteira se algum deles estiver faltando.
--
-- MODELO DE SEGURANÇA (nada aqui afrouxa as regras existentes):
--   * Cargo (role) NUNCA é alterado pelo próprio usuário: protect_profile_columns recusa (42501).
--   * 'admin' continua exclusivo da conta do proprietário (guard_admin_role + is_admin()).
--   * Toda escrita administrativa passa por is_admin() — via RLS ou na 1ª linha das RPCs.
--   * account_deletion_requests: anon NÃO tem INSERT direto. Só a RPC request_account_deletion,
--     que valida, normaliza e aplica rate limit (IP com HMAC, e-mail e teto global).
--   * store_products: leitura pública só de itens 'active'; rascunhos só para o admin.
--   * Imagens da loja ficam no bucket store-media (caminho validado, sem link externo).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Pré-requisitos
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Falta public.is_admin(): rode 2026-11-08_admin_lockdown.sql antes.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_profiles_protect_columns' AND tgrelid = 'public.profiles'::regclass) THEN
    RAISE EXCEPTION 'Falta o trigger tr_profiles_protect_columns: rode 2026-11-10_profile_security_stats.sql antes.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_profiles_guard_admin_role' AND tgrelid = 'public.profiles'::regclass) THEN
    RAISE EXCEPTION 'Falta o trigger tr_profiles_guard_admin_role: rode 2026-11-08_admin_lockdown.sql antes.';
  END IF;
  IF to_regclass('public.admin_audit_log') IS NULL THEN
    RAISE EXCEPTION 'Falta public.admin_audit_log: rode 2026-11-11_admin_hub.sql antes.';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Utilitário: updated_at automático
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 1. profiles.role: user | vip | personal | nutricionista | admin
-- -----------------------------------------------------------------------------
-- Normaliza valores legados antes do CHECK (rodar a consulta abaixo ANTES, se quiser conferir):
--   SELECT role, count(*) FROM public.profiles GROUP BY role;
UPDATE public.profiles SET role = lower(btrim(role))
WHERE role IS NOT NULL AND role <> lower(btrim(role));

UPDATE public.profiles SET role = 'user'
WHERE role IS NULL OR role NOT IN ('user', 'vip', 'personal', 'nutricionista', 'admin');

-- Remove qualquer CHECK antigo sobre role (o nome pode variar entre ambientes)
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ~* '\mrole\M'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'vip', 'personal', 'nutricionista', 'admin'));

-- Troca de cargo pelo painel (substitui a versão de 2026-11-11, mesma assinatura).
-- 'admin' continua fora: o cargo é exclusivo do proprietário e não é concedido pelo painel.
CREATE OR REPLACE FUNCTION public.admin_set_athlete_role(p_user_id uuid, p_role text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador.' USING ERRCODE = '42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('user', 'vip', 'personal', 'nutricionista') THEN
    RAISE EXCEPTION 'Cargo inválido: use user, vip, personal ou nutricionista.' USING ERRCODE = '22023';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'O administrador não altera o próprio cargo.' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(role, 'user') INTO v_old FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = '22023';
  END IF;
  IF v_old = 'admin' THEN
    RAISE EXCEPTION 'O cargo admin não é alterado pelo painel.' USING ERRCODE = '42501';
  END IF;
  IF v_old = p_role THEN
    RETURN v_old;
  END IF;

  UPDATE public.profiles SET role = p_role, updated_at = now() WHERE id = p_user_id;

  -- Deixou de ser profissional: o cadastro profissional sai da vitrine (não é apagado).
  IF to_regclass('public.professionals') IS NOT NULL THEN
    UPDATE public.professionals SET is_active = false
    WHERE profile_id = p_user_id AND kind <> p_role AND is_active;
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, details)
  VALUES (auth.uid(), 'set_role', p_user_id, jsonb_build_object('from', v_old, 'to', p_role));
  RETURN p_role;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_athlete_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_athlete_role(uuid, text) TO authenticated;

-- Lista de usuários: mesmos filtros de 2026-11-11 + personal, nutricionista e team (equipe).
CREATE OR REPLACE FUNCTION public.admin_list_athletes(
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := greatest(1, least(50, coalesce(p_limit, 20)));
  v_offset integer := greatest(0, least(10000, coalesce(p_offset, 0)));
  v_pattern text := public.admin_like_pattern(p_search);
  v_status text := coalesce(p_status, 'all');
  v_items jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador.' USING ERRCODE = '42501';
  END IF;
  IF v_status NOT IN ('all', 'vip', 'free', 'active', 'inactive', 'pathology', 'personal', 'nutricionista', 'team') THEN
    RAISE EXCEPTION 'Filtro inválido.' USING ERRCODE = '22023';
  END IF;

  WITH base AS (
    SELECT
      p.id, p.full_name, coalesce(u.email, p.email) AS email, coalesce(p.role, 'user') AS role,
      p.goal, p.pathologies, p.created_at, p.onboarding_completed,
      (SELECT max(w.created_at) FROM public.workout_logs w WHERE w.user_id = p.id) AS last_workout_at,
      (SELECT max(r.created_at) FROM public.runs r WHERE r.user_id = p.id) AS last_run_at
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE v_pattern IS NULL
       OR p.full_name ILIKE v_pattern ESCAPE '\'
       OR coalesce(u.email, p.email) ILIKE v_pattern ESCAPE '\'
  ),
  filtered AS (
    SELECT b.*, greatest(b.last_workout_at, b.last_run_at) AS last_active_at
    FROM base b
  ),
  page AS (
    SELECT * FROM filtered f
    WHERE CASE v_status
      WHEN 'vip' THEN f.role = 'vip'
      WHEN 'free' THEN f.role = 'user'
      WHEN 'personal' THEN f.role = 'personal'
      WHEN 'nutricionista' THEN f.role = 'nutricionista'
      WHEN 'team' THEN f.role IN ('personal', 'nutricionista')
      WHEN 'active' THEN f.last_active_at >= now() - interval '7 days'
      WHEN 'inactive' THEN f.last_active_at IS NULL OR f.last_active_at < now() - interval '30 days'
      WHEN 'pathology' THEN nullif(btrim(coalesce(f.pathologies, '')), '') IS NOT NULL
        AND lower(btrim(f.pathologies)) NOT IN ('sem restrições', 'sem restricoes', 'sem restrição', 'nenhuma', 'nenhum')
      ELSE true
    END
    ORDER BY f.created_at DESC, f.id
    LIMIT v_limit + 1 OFFSET v_offset
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'full_name', full_name, 'email', email, 'role', role, 'goal', goal,
    'pathologies', pathologies, 'created_at', created_at, 'onboarding_completed', onboarding_completed,
    'last_workout_at', last_workout_at, 'last_run_at', last_run_at, 'last_active_at', last_active_at
  ) ORDER BY created_at DESC, id), '[]'::jsonb)
  INTO v_items
  FROM page;

  RETURN jsonb_build_object(
    'items', CASE WHEN jsonb_array_length(v_items) > v_limit THEN v_items - v_limit ELSE v_items END,
    'has_more', jsonb_array_length(v_items) > v_limit,
    'next_offset', v_offset + least(jsonb_array_length(v_items), v_limit)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_athletes(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_athletes(text, text, integer, integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. professionals: Personal Trainers (CREF) e Nutricionistas (CRN) reais
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('personal', 'nutricionista')),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 3 AND 80),
  council_type text GENERATED ALWAYS AS (CASE kind WHEN 'personal' THEN 'CREF' ELSE 'CRN' END) STORED,
  -- CREF: 012345-G (G = graduado, P = provisionado). CRN: 12345 (opcional sufixo /P).
  council_number text NOT NULL CHECK (council_number ~ '^[0-9]{3,6}(-[GP])?(/P)?$'),
  council_uf text NOT NULL CHECK (council_uf IN (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR',
    'PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  specialty text NOT NULL CHECK (char_length(specialty) BETWEEN 3 AND 80),
  bio text CHECK (bio IS NULL OR char_length(bio) <= 600),
  service_mode text NOT NULL DEFAULT 'hibrido' CHECK (service_mode IN ('online', 'presencial', 'hibrido')),
  availability_days text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (availability_days <@ ARRAY['seg','ter','qua','qui','sex','sab','dom']::text[]),
  availability_notes text CHECK (availability_notes IS NULL OR char_length(availability_notes) <= 200),
  city text CHECK (city IS NULL OR char_length(city) <= 60),
  accepting_clients boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professionals_council_unique UNIQUE (kind, council_uf, council_number)
);

COMMENT ON TABLE public.professionals IS
  'Equipe multidisciplinar real (CREF/CRN). Escrita só por admin_upsert_professional / admin_remove_professional.';

DROP TRIGGER IF EXISTS tr_professionals_touch ON public.professionals;
CREATE TRIGGER tr_professionals_touch BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS professionals_kind_active_idx ON public.professionals (kind, is_active);

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Logados veem profissionais ativos; admin vê todos" ON public.professionals;
CREATE POLICY "Logados veem profissionais ativos; admin vê todos"
  ON public.professionals FOR SELECT
  TO authenticated
  USING (is_active OR profile_id = auth.uid() OR public.is_admin());
-- Sem policy de escrita: só as RPCs abaixo (SECURITY DEFINER, admin + auditoria).

REVOKE ALL ON public.professionals FROM anon, authenticated, public;
GRANT SELECT ON public.professionals TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_professional(
  p_profile_id uuid,
  p_kind text,
  p_display_name text,
  p_council_number text,
  p_council_uf text,
  p_specialty text,
  p_bio text DEFAULT NULL,
  p_service_mode text DEFAULT 'hibrido',
  p_availability_days text[] DEFAULT '{}'::text[],
  p_availability_notes text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_accepting_clients boolean DEFAULT true,
  p_is_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_id uuid;
  v_days text[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador.' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('personal', 'nutricionista') THEN
    RAISE EXCEPTION 'Tipo de profissional inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_profile_id = auth.uid() THEN
    RAISE EXCEPTION 'A conta administradora não é cadastrada como profissional.' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(role, 'user') INTO v_role FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = '22023';
  END IF;
  IF v_role = 'admin' THEN
    RAISE EXCEPTION 'A conta administradora não é cadastrada como profissional.' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(array_agg(DISTINCT d), '{}'::text[]) INTO v_days
  FROM unnest(coalesce(p_availability_days, '{}'::text[])) AS d;

  INSERT INTO public.professionals AS pr (
    profile_id, kind, display_name, council_number, council_uf, specialty, bio, service_mode,
    availability_days, availability_notes, city, accepting_clients, is_active, created_by
  ) VALUES (
    p_profile_id, p_kind,
    btrim(p_display_name),
    upper(regexp_replace(coalesce(p_council_number, ''), '\s', '', 'g')),
    upper(btrim(coalesce(p_council_uf, ''))),
    btrim(p_specialty),
    nullif(btrim(coalesce(p_bio, '')), ''),
    coalesce(p_service_mode, 'hibrido'),
    v_days,
    nullif(btrim(coalesce(p_availability_notes, '')), ''),
    nullif(btrim(coalesce(p_city, '')), ''),
    coalesce(p_accepting_clients, true),
    coalesce(p_is_active, true),
    auth.uid()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    kind = EXCLUDED.kind,
    display_name = EXCLUDED.display_name,
    council_number = EXCLUDED.council_number,
    council_uf = EXCLUDED.council_uf,
    specialty = EXCLUDED.specialty,
    bio = EXCLUDED.bio,
    service_mode = EXCLUDED.service_mode,
    availability_days = EXCLUDED.availability_days,
    availability_notes = EXCLUDED.availability_notes,
    city = EXCLUDED.city,
    accepting_clients = EXCLUDED.accepting_clients,
    is_active = EXCLUDED.is_active
  RETURNING pr.id INTO v_id;

  -- Cargo acompanha o cadastro profissional ativo
  IF coalesce(p_is_active, true) AND v_role <> p_kind THEN
    UPDATE public.profiles SET role = p_kind, updated_at = now() WHERE id = p_profile_id;
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, details)
  VALUES (auth.uid(), 'upsert_professional', p_profile_id,
          jsonb_build_object('kind', p_kind, 'active', coalesce(p_is_active, true), 'previous_role', v_role));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_upsert_professional(uuid, text, text, text, text, text, text, text, text[], text, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_professional(uuid, text, text, text, text, text, text, text, text[], text, text, boolean, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_remove_professional(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.professionals WHERE profile_id = p_profile_id RETURNING kind INTO v_kind;
  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'Profissional não encontrado.' USING ERRCODE = '22023';
  END IF;

  -- Volta a usuário comum só se o cargo ainda for o do cadastro removido
  UPDATE public.profiles SET role = 'user', updated_at = now()
  WHERE id = p_profile_id AND role = v_kind;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, details)
  VALUES (auth.uid(), 'remove_professional', p_profile_id, jsonb_build_object('kind', v_kind));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_remove_professional(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_professional(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. store_products: catálogo da futura Loja MOVE+
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 100),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 100),
  category text NOT NULL CHECK (category IN ('suplementos', 'vestuario', 'acessorios', 'equipamentos', 'programas')),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  price_cents integer NOT NULL CHECK (price_cents BETWEEN 0 AND 10000000),
  stock integer NOT NULL DEFAULT 0 CHECK (stock BETWEEN 0 AND 1000000),
  -- Caminho no bucket store-media (nada de URL externa: evita rastreio, hotlink e conteúdo arbitrário)
  image_path text CHECK (image_path IS NULL OR image_path ~ '^products/[a-z0-9-]+/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'draft')),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_products_status_idx ON public.store_products (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.store_products_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  ELSE
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_store_products_stamp ON public.store_products;
CREATE TRIGGER tr_store_products_stamp BEFORE INSERT OR UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.store_products_stamp();

ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública de produtos ativos" ON public.store_products;
CREATE POLICY "Leitura pública de produtos ativos"
  ON public.store_products FOR SELECT
  TO anon, authenticated
  USING (status = 'active' OR public.is_admin());

DROP POLICY IF EXISTS "Admin cria produtos" ON public.store_products;
CREATE POLICY "Admin cria produtos"
  ON public.store_products FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin edita produtos" ON public.store_products;
CREATE POLICY "Admin edita produtos"
  ON public.store_products FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin exclui produtos" ON public.store_products;
CREATE POLICY "Admin exclui produtos"
  ON public.store_products FOR DELETE TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.store_products FROM anon, authenticated, public;
GRANT SELECT ON public.store_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_products TO authenticated;

-- Bucket público de imagens da loja (leitura aberta, escrita só do admin)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('store-media', 'store-media', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Admin envia mídia da loja" ON storage.objects;
CREATE POLICY "Admin envia mídia da loja" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-media' AND public.is_admin());

DROP POLICY IF EXISTS "Admin atualiza mídia da loja" ON storage.objects;
CREATE POLICY "Admin atualiza mídia da loja" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'store-media' AND public.is_admin())
  WITH CHECK (bucket_id = 'store-media' AND public.is_admin());

DROP POLICY IF EXISTS "Admin remove mídia da loja" ON storage.objects;
CREATE POLICY "Admin remove mídia da loja" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'store-media' AND public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. account_deletion_requests: pedidos de exclusão vindos da web (Google Play)
-- -----------------------------------------------------------------------------
-- Segredo do HMAC de IP: guardado num schema sem acesso pela API.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);
REVOKE ALL ON private.app_settings FROM PUBLIC, anon, authenticated;
INSERT INTO private.app_settings (key, value)
VALUES ('deletion_ip_secret', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text NOT NULL UNIQUE,
  email text NOT NULL CHECK (char_length(email) BETWEEN 6 AND 254 AND email ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'),
  full_name text CHECK (full_name IS NULL OR char_length(full_name) <= 100),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  -- Conta correspondente no momento do pedido (vira NULL quando a conta é apagada; o pedido fica como registro).
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'app', 'suporte')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  ip_hash text,
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 300),
  admin_notes text CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 1000),
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS adr_email_created_idx ON public.account_deletion_requests (email, created_at DESC);
CREATE INDEX IF NOT EXISTS adr_ip_created_idx ON public.account_deletion_requests (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS adr_status_created_idx ON public.account_deletion_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS adr_created_idx ON public.account_deletion_requests (created_at DESC);

-- Admin só altera status e observações; dados do titular e metadados são imutáveis.
CREATE OR REPLACE FUNCTION public.account_deletion_requests_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.protocol := OLD.protocol;
  NEW.email := OLD.email;
  NEW.full_name := OLD.full_name;
  NEW.reason := OLD.reason;
  NEW.user_id := CASE WHEN NEW.user_id IS NULL THEN NULL ELSE OLD.user_id END; -- só o ON DELETE SET NULL
  NEW.source := OLD.source;
  NEW.ip_hash := OLD.ip_hash;
  NEW.user_agent := OLD.user_agent;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.handled_by := auth.uid();
    NEW.handled_at := now();
  ELSE
    NEW.handled_by := OLD.handled_by;
    NEW.handled_at := OLD.handled_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_adr_guard ON public.account_deletion_requests;
CREATE TRIGGER tr_adr_guard BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.account_deletion_requests_guard();

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin lê solicitações de exclusão" ON public.account_deletion_requests;
CREATE POLICY "Admin lê solicitações de exclusão"
  ON public.account_deletion_requests FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin gerencia solicitações de exclusão" ON public.account_deletion_requests;
CREATE POLICY "Admin gerencia solicitações de exclusão"
  ON public.account_deletion_requests FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
-- Sem policy de INSERT (só a RPC abaixo) e sem DELETE (o pedido é registro de conformidade).

REVOKE ALL ON public.account_deletion_requests FROM anon, authenticated, public;
GRANT SELECT, UPDATE ON public.account_deletion_requests TO authenticated;

-- RPC pública de solicitação. Resposta é sempre genérica: não revela se o e-mail tem conta.
-- Rate limit: 3 pedidos/hora por IP, 1 pedido aberto por e-mail (30 dias), 200 pedidos/hora no total.
-- Erros de limite usam SQLSTATE PT429 (o PostgREST responde HTTP 429).
CREATE OR REPLACE FUNCTION public.request_account_deletion(
  p_email text,
  p_full_name text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := nullif(left(btrim(regexp_replace(coalesce(p_full_name, ''), '[[:cntrl:]]', ' ', 'g')), 100), '');
  v_reason text := nullif(left(btrim(regexp_replace(coalesce(p_reason, ''), '[[:cntrl:]]', ' ', 'g')), 500), '');
  v_headers jsonb;
  v_ip text;
  v_ip_hash text;
  v_ua text;
  v_secret text;
  v_existing text;
  v_protocol text;
  v_user uuid;
BEGIN
  IF char_length(v_email) < 6 OR char_length(v_email) > 254
     OR v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido.' USING ERRCODE = '22023';
  END IF;

  -- Serializa pedidos do mesmo e-mail (evita duplicata em corrida)
  PERFORM pg_advisory_xact_lock(hashtextextended('adr:' || v_email, 0));

  -- Cabeçalhos do PostgREST (IP real do cliente atrás do proxy do Supabase)
  BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    v_headers := NULL;
  END;
  v_ip := nullif(btrim(coalesce(
    v_headers ->> 'cf-connecting-ip',
    split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1),
    v_headers ->> 'x-real-ip'
  )), '');
  v_ua := nullif(left(regexp_replace(coalesce(v_headers ->> 'user-agent', ''), '[[:cntrl:]]', ' ', 'g'), 300), '');

  IF v_ip IS NOT NULL THEN
    SELECT value INTO v_secret FROM private.app_settings WHERE key = 'deletion_ip_secret';
    v_ip_hash := encode(extensions.hmac(v_ip, coalesce(v_secret, 'moveplus'), 'sha256'), 'hex');

    IF (SELECT count(*) FROM public.account_deletion_requests
        WHERE ip_hash = v_ip_hash AND created_at >= now() - interval '1 hour') >= 3 THEN
      RAISE EXCEPTION 'Muitas solicitações deste dispositivo. Tente novamente em 1 hora.' USING ERRCODE = 'PT429';
    END IF;
  END IF;

  IF (SELECT count(*) FROM public.account_deletion_requests
      WHERE created_at >= now() - interval '1 hour') >= 200 THEN
    RAISE EXCEPTION 'Recebemos muitas solicitações agora. Tente novamente mais tarde.' USING ERRCODE = 'PT429';
  END IF;

  -- Já existe pedido aberto para o e-mail: devolve o mesmo protocolo, sem criar outro.
  SELECT protocol INTO v_existing FROM public.account_deletion_requests
  WHERE email = v_email AND status IN ('pending', 'in_progress') AND created_at >= now() - interval '30 days'
  ORDER BY created_at DESC LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'protocol', v_existing, 'deadline_days', 30);
  END IF;

  SELECT id INTO v_user FROM auth.users WHERE lower(email) = v_email LIMIT 1;
  v_protocol := 'MP-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD') || '-'
                || upper(encode(extensions.gen_random_bytes(4), 'hex'));

  INSERT INTO public.account_deletion_requests (protocol, email, full_name, reason, user_id, source, ip_hash, user_agent)
  VALUES (v_protocol, v_email, v_name, v_reason, v_user, 'web', v_ip_hash, v_ua);

  RETURN jsonb_build_object('ok', true, 'protocol', v_protocol, 'deadline_days', 30);
END;
$$;
REVOKE ALL ON FUNCTION public.request_account_deletion(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(text, text, text) TO anon, authenticated;

COMMIT;

-- =============================================================================
-- Conferência
-- =============================================================================
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_role_check';
-- Esperado: CHECK (role = ANY (ARRAY['user','vip','personal','nutricionista','admin']))

SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('professionals', 'store_products', 'account_deletion_requests')
ORDER BY tablename, cmd;
-- Esperado: professionals 1 SELECT; store_products SELECT/INSERT/UPDATE/DELETE; account_deletion_requests SELECT/UPDATE

SELECT table_name, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('professionals', 'store_products', 'account_deletion_requests')
  AND grantee IN ('anon', 'authenticated')
GROUP BY table_name, grantee ORDER BY 1, 2;
-- Esperado: anon só SELECT em store_products. Nenhum INSERT para anon em lugar nenhum.

-- Testes manuais (como usuário comum, pelo app ou trocando o JWT no SQL Editor):
--   UPDATE public.profiles SET role = 'personal' WHERE id = auth.uid();   -- erro 42501
--   SELECT public.admin_set_athlete_role('<uuid>', 'vip');                -- erro 42501
--   INSERT INTO public.account_deletion_requests (protocol, email) VALUES ('x', 'a@b.co'); -- negado
--   SELECT public.request_account_deletion('teste@exemplo.com', 'Teste', NULL);           -- ok + protocolo
