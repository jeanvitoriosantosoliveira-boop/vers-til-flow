-- =============================================================================
-- ATUALIZAÇÃO DO BANCO ATUAL → compatível com o app Versátil Flow
-- Rode INTEIRO no SQL Editor do Supabase (projeto mmscdrlugnbziomirihl)
-- Seguro para rodar mais de uma vez (idempotente)
-- =============================================================================

-- 1) Status "paused" no enum client_status
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'paused' AND enumtypid = 'public.client_status'::regtype
  ) THEN
    ALTER TYPE public.client_status ADD VALUE 'paused';
  END IF;
END $$;

-- 2) Logo do cliente
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS logo_url text;

-- 3) Catálogo de serviços (faltava — causa 404 em /rest/v1/services)
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  default_price numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services ALTER COLUMN default_price DROP DEFAULT;
ALTER TABLE public.services ALTER COLUMN default_price DROP NOT NULL;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS services_select_auth ON public.services;
CREATE POLICY services_select_auth ON public.services
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS services_modify_leader ON public.services;
DROP POLICY IF EXISTS services_modify_admin ON public.services;
CREATE POLICY services_modify_admin ON public.services
  FOR ALL TO authenticated
  USING (public.is_leader_or_manager(auth.uid()))
  WITH CHECK (public.is_leader_or_manager(auth.uid()));

GRANT ALL ON TABLE public.services TO authenticated, service_role;

-- 4) Serviços contratados por cliente
CREATE TABLE IF NOT EXISTS public.client_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  monthly_price numeric,
  started_at date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, service_id)
);

ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cs_select_auth ON public.client_services;
CREATE POLICY cs_select_auth ON public.client_services
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cs_modify_leader ON public.client_services;
DROP POLICY IF EXISTS cs_modify_admin ON public.client_services;
CREATE POLICY cs_modify_leader ON public.client_services
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'leader'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'leader'::app_role));

GRANT ALL ON TABLE public.client_services TO authenticated, service_role;

-- 5) Colaboradores vinculados a clientes (faltava — causa 404 em /rest/v1/client_collaborators)
CREATE TABLE IF NOT EXISTS public.client_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_collaborators_unique_manual
  ON public.client_collaborators (client_id, user_id) WHERE team_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS client_collaborators_unique_team
  ON public.client_collaborators (client_id, user_id, team_id) WHERE team_id IS NOT NULL;

ALTER TABLE public.client_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cc_select_auth ON public.client_collaborators;
CREATE POLICY cc_select_auth ON public.client_collaborators
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cc_modify_admin ON public.client_collaborators;
CREATE POLICY cc_modify_admin ON public.client_collaborators
  FOR ALL TO authenticated
  USING (public.is_leader_or_manager(auth.uid()))
  WITH CHECK (public.is_leader_or_manager(auth.uid()));

GRANT ALL ON TABLE public.client_collaborators TO authenticated, service_role;

-- 6) Ao remover cliente, remove tarefas vinculadas
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_client_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- 7) Sincronizar cliente ↔ time ↔ membros (auto-vínculo)
CREATE OR REPLACE FUNCTION public.sync_client_team_links()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_collaborators (client_id, user_id, source, team_id)
    SELECT NEW.client_id, tm.user_id, 'team', NEW.team_id
    FROM public.team_members tm
    WHERE tm.team_id = NEW.team_id
      AND NOT EXISTS (
        SELECT 1 FROM public.client_collaborators cc
        WHERE cc.client_id = NEW.client_id
          AND cc.user_id = tm.user_id
          AND cc.team_id = NEW.team_id
      );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.client_collaborators
    WHERE client_id = OLD.client_id AND team_id = OLD.team_id AND source = 'team';
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_client_teams ON public.client_teams;
CREATE TRIGGER trg_sync_client_teams
AFTER INSERT OR DELETE ON public.client_teams
FOR EACH ROW EXECUTE FUNCTION public.sync_client_team_links();

CREATE OR REPLACE FUNCTION public.sync_team_member_clients()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_collaborators (client_id, user_id, source, team_id)
    SELECT ct.client_id, NEW.user_id, 'team', NEW.team_id
    FROM public.client_teams ct
    WHERE ct.team_id = NEW.team_id
      AND NOT EXISTS (
        SELECT 1 FROM public.client_collaborators cc
        WHERE cc.client_id = ct.client_id
          AND cc.user_id = NEW.user_id
          AND cc.team_id = NEW.team_id
      );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.client_collaborators
    WHERE user_id = OLD.user_id AND team_id = OLD.team_id AND source = 'team';
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_team_members ON public.team_members;
CREATE TRIGGER trg_sync_team_members
AFTER INSERT OR DELETE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.sync_team_member_clients();

-- 8) Cliente pausado/arquivado → desvincula colaboradores e times
CREATE OR REPLACE FUNCTION public.clear_client_links_on_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('paused', 'archived') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    DELETE FROM public.client_collaborators WHERE client_id = NEW.id;
    DELETE FROM public.client_teams WHERE client_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clear_client_links ON public.clients;
CREATE TRIGGER trg_clear_client_links
AFTER UPDATE OF status ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clear_client_links_on_status();

-- 9) Backfill: vínculos já existentes time ↔ cliente ↔ membro
INSERT INTO public.client_collaborators (client_id, user_id, source, team_id)
SELECT ct.client_id, tm.user_id, 'team', ct.team_id
FROM public.client_teams ct
JOIN public.team_members tm ON tm.team_id = ct.team_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_collaborators cc
  WHERE cc.client_id = ct.client_id
    AND cc.user_id = tm.user_id
    AND cc.team_id = ct.team_id
);

-- 10) Bucket avatars (foto de perfil)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars upload own" ON storage.objects;
CREATE POLICY "avatars upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars update own" ON storage.objects;
CREATE POLICY "avatars update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars delete own" ON storage.objects;
CREATE POLICY "avatars delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 11) Bucket client-logos (logo da empresa)
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "client logos public read" ON storage.objects;
CREATE POLICY "client logos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'client-logos');

DROP POLICY IF EXISTS "client logos upload admin" ON storage.objects;
CREATE POLICY "client logos upload admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-logos'
    AND public.is_leader_or_manager(auth.uid())
  );

DROP POLICY IF EXISTS "client logos update admin" ON storage.objects;
CREATE POLICY "client logos update admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'client-logos' AND public.is_leader_or_manager(auth.uid()));

DROP POLICY IF EXISTS "client logos delete admin" ON storage.objects;
CREATE POLICY "client logos delete admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-logos' AND public.is_leader_or_manager(auth.uid()));

-- 12) Notificações individuais (só insere para si ou líder)
DROP POLICY IF EXISTS notif_insert_admin ON public.notifications;
CREATE POLICY notif_insert_admin ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'leader'::app_role));

-- 13) Satisfação do cliente liberada para qualquer perfil autenticado
DROP POLICY IF EXISTS csh_select_auth ON public.client_satisfaction_history;
CREATE POLICY csh_select_auth ON public.client_satisfaction_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS csh_insert_admin ON public.client_satisfaction_history;
DROP POLICY IF EXISTS csh_insert_auth ON public.client_satisfaction_history;
CREATE POLICY csh_insert_auth ON public.client_satisfaction_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = recorded_by OR recorded_by IS NULL);

CREATE OR REPLACE FUNCTION public.set_client_satisfaction(p_client_id uuid, p_rating integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'A satisfação deve estar entre 1 e 5.';
  END IF;

  UPDATE public.clients
  SET satisfaction = p_rating
  WHERE id = p_client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;

  INSERT INTO public.client_satisfaction_history (client_id, rating, recorded_by)
  VALUES (p_client_id, p_rating, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_client_satisfaction(uuid, integer) TO authenticated;

-- 14) Financeiro restrito ao líder
DROP POLICY IF EXISTS exp_admin ON public.expenses;
CREATE POLICY exp_admin ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'leader'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'leader'::app_role));

DROP POLICY IF EXISTS cash_admin ON public.cash_adjustments;
CREATE POLICY cash_admin ON public.cash_adjustments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'leader'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'leader'::app_role));

DROP POLICY IF EXISTS fset_admin ON public.finance_settings;
CREATE POLICY fset_admin ON public.finance_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'leader'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'leader'::app_role));

-- 15) Realtime notificações
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 16) Recarrega API REST (PostgREST)
NOTIFY pgrst, 'reload schema';
