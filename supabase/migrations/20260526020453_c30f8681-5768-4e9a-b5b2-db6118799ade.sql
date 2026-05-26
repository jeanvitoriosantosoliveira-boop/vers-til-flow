
-- 1. Add 'paused' to client_status enum if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'paused' AND enumtypid = 'public.client_status'::regtype) THEN
    ALTER TYPE public.client_status ADD VALUE 'paused';
  END IF;
END $$;

-- 2. Services catalog
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  default_price numeric DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS services_select_auth ON public.services;
CREATE POLICY services_select_auth ON public.services FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS services_modify_leader ON public.services;
CREATE POLICY services_modify_leader ON public.services FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'leader'::app_role))
  WITH CHECK (has_role(auth.uid(), 'leader'::app_role));

-- 3. Client services join
CREATE TABLE IF NOT EXISTS public.client_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  monthly_price numeric DEFAULT 0,
  started_at date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, service_id)
);
ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cs_select_auth ON public.client_services;
CREATE POLICY cs_select_auth ON public.client_services FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cs_modify_leader ON public.client_services;
CREATE POLICY cs_modify_leader ON public.client_services FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'leader'::app_role))
  WITH CHECK (has_role(auth.uid(), 'leader'::app_role));

-- 4. Client collaborators
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
CREATE POLICY cc_select_auth ON public.client_collaborators FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cc_modify_admin ON public.client_collaborators;
CREATE POLICY cc_modify_admin ON public.client_collaborators FOR ALL TO authenticated
  USING (is_leader_or_manager(auth.uid()))
  WITH CHECK (is_leader_or_manager(auth.uid()));

-- 5. Sync client_teams -> client_collaborators
CREATE OR REPLACE FUNCTION public.sync_client_team_links()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_collaborators (client_id, user_id, source, team_id)
    SELECT NEW.client_id, tm.user_id, 'team', NEW.team_id
    FROM public.team_members tm
    WHERE tm.team_id = NEW.team_id
    ON CONFLICT DO NOTHING;
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

-- 6. Sync team_members -> client_collaborators (for clients already attached to the team)
CREATE OR REPLACE FUNCTION public.sync_team_member_clients()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_collaborators (client_id, user_id, source, team_id)
    SELECT ct.client_id, NEW.user_id, 'team', NEW.team_id
    FROM public.client_teams ct
    WHERE ct.team_id = NEW.team_id
    ON CONFLICT DO NOTHING;
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

-- 7. Client paused/inactive -> clear links
CREATE OR REPLACE FUNCTION public.clear_client_links_on_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('paused','inactive') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    DELETE FROM public.client_collaborators WHERE client_id = NEW.id;
    DELETE FROM public.client_teams WHERE client_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_clear_client_links ON public.clients;
CREATE TRIGGER trg_clear_client_links
AFTER UPDATE OF status ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clear_client_links_on_status();

-- 8. Notify assignee on task changes
CREATE OR REPLACE FUNCTION public.notify_task_assignee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target uuid;
  ntype text;
  ntitle text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target := NEW.assignee_id;
    ntype := 'task_created';
    ntitle := 'Nova tarefa atribuída: ' || NEW.title;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM NEW.status THEN
      target := NEW.assignee_id;
      ntype := 'task_done';
      ntitle := 'Tarefa concluída: ' || NEW.title;
    ELSIF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      target := NEW.assignee_id;
      ntype := 'task_created';
      ntitle := 'Tarefa atribuída a você: ' || NEW.title;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      target := NEW.assignee_id;
      ntype := 'task_updated';
      ntitle := 'Tarefa atualizada: ' || NEW.title;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  IF target IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (target, ntype, ntitle, COALESCE(NEW.description, ''));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_task ON public.tasks;
CREATE TRIGGER trg_notify_task
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignee();

-- 9. Satisfaction insert open to all auth
DROP POLICY IF EXISTS csh_insert_admin ON public.client_satisfaction_history;
DROP POLICY IF EXISTS csh_insert_auth ON public.client_satisfaction_history;
CREATE POLICY csh_insert_auth ON public.client_satisfaction_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = recorded_by OR recorded_by IS NULL);

-- 10. Avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars upload own" ON storage.objects;
CREATE POLICY "avatars upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "avatars update own" ON storage.objects;
CREATE POLICY "avatars update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "avatars delete own" ON storage.objects;
CREATE POLICY "avatars delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 11. Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 12. Allow managers to insert collaborator roles
DROP POLICY IF EXISTS roles_manager_insert_collab ON public.user_roles;
CREATE POLICY roles_manager_insert_collab ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (is_leader_or_manager(auth.uid()) AND role = 'collaborator'::app_role);
