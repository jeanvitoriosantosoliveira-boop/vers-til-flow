-- Integra a UI atual ao schema do Supabase e habilita sincronizacao em tempo real.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS salary NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS segment TEXT,
  ADD COLUMN IF NOT EXISTS monthly_hours_target INTEGER DEFAULT 40,
  ADD COLUMN IF NOT EXISTS contract_months INTEGER,
  ADD COLUMN IF NOT EXISTS health TEXT DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS services TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.kanban_columns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  accent TEXT NOT NULL DEFAULT 'bg-muted-foreground',
  "order" INTEGER NOT NULL DEFAULT 0,
  base public.task_status,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

INSERT INTO public.kanban_columns (id, title, accent, "order", base)
VALUES
  ('todo', 'A Fazer', 'bg-muted-foreground', 0, 'todo'),
  ('in_progress', 'Em Andamento', 'bg-primary', 1, 'in_progress'),
  ('review', 'Em Revisão', 'bg-warning', 2, 'review'),
  ('done', 'Concluído', 'bg-success', 3, 'done')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  accent = EXCLUDED.accent,
  "order" = EXCLUDED."order",
  base = EXCLUDED.base;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS column_id TEXT REFERENCES public.kanban_columns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_spawn TIMESTAMPTZ;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS recurring BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.extra_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.extra_services ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.team_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_columns' AND policyname = 'kanban_columns_select_auth') THEN
    CREATE POLICY "kanban_columns_select_auth" ON public.kanban_columns
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_columns' AND policyname = 'kanban_columns_modify_admin') THEN
    CREATE POLICY "kanban_columns_modify_admin" ON public.kanban_columns
      FOR ALL TO authenticated
      USING (public.is_leader_or_manager(auth.uid()))
      WITH CHECK (public.is_leader_or_manager(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'extra_services' AND policyname = 'extra_services_admin') THEN
    CREATE POLICY "extra_services_admin" ON public.extra_services
      FOR ALL TO authenticated
      USING (public.is_leader_or_manager(auth.uid()))
      WITH CHECK (public.is_leader_or_manager(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_notes' AND policyname = 'team_notes_select_auth') THEN
    CREATE POLICY "team_notes_select_auth" ON public.team_notes
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_notes' AND policyname = 'team_notes_admin') THEN
    CREATE POLICY "team_notes_admin" ON public.team_notes
      FOR ALL TO authenticated
      USING (public.is_leader_or_manager(auth.uid()))
      WITH CHECK (public.is_leader_or_manager(auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_column ON public.tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tasks_template ON public.tasks(template_id);
CREATE INDEX IF NOT EXISTS idx_extra_services_client ON public.extra_services(client_id);
CREATE INDEX IF NOT EXISTS idx_team_notes_user ON public.team_notes(user_id);

CREATE OR REPLACE FUNCTION public.recalculate_task_total_seconds(_task_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tasks
  SET total_seconds = COALESCE((SELECT SUM(seconds)::INTEGER FROM public.time_entries WHERE task_id = _task_id), 0)
  WHERE id = _task_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_task_total_seconds()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_task_total_seconds(OLD.task_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalculate_task_total_seconds(NEW.task_id);
  IF TG_OP = 'UPDATE' AND OLD.task_id IS DISTINCT FROM NEW.task_id THEN
    PERFORM public.recalculate_task_total_seconds(OLD.task_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_time_entries_total_seconds ON public.time_entries;
CREATE TRIGGER trg_time_entries_total_seconds
AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.sync_task_total_seconds();

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tasks',
    'comments',
    'time_entries',
    'clients',
    'profiles',
    'teams',
    'team_members',
    'expenses',
    'cash_adjustments',
    'finance_settings',
    'notifications',
    'kanban_columns',
    'extra_services',
    'team_notes',
    'client_satisfaction_history',
    'user_roles'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;
