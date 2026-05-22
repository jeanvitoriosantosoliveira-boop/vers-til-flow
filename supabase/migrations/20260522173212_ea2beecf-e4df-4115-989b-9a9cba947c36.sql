
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('leader', 'manager', 'collaborator');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'review', 'done');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.client_status AS ENUM ('active', 'paused', 'archived');
CREATE TYPE public.team_member_role AS ENUM ('manager', 'member');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  position TEXT,
  birth_date DATE,
  skills TEXT[] DEFAULT '{}',
  hourly_rate NUMERIC(10,2),
  contract_start DATE,
  contract_end DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ has_role helper ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_leader_or_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('leader','manager'))
$$;

-- ============ TEAMS ============
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  leader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_team team_member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- ============ CLIENTS ============
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  status client_status NOT NULL DEFAULT 'active',
  contract_start DATE,
  contract_end DATE,
  monthly_value NUMERIC(12,2),
  satisfaction INTEGER CHECK (satisfaction BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.client_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  UNIQUE (client_id, team_id)
);
ALTER TABLE public.client_teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.client_satisfaction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES public.profiles(id)
);
ALTER TABLE public.client_satisfaction_history ENABLE ROW LEVEL SECURITY;

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  total_seconds INTEGER NOT NULL DEFAULT 0,
  recurrence JSONB,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  seconds INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- ============ FINANCE ============
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cash_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(12,2) NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('in','out')),
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_adjustments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.finance_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  -- Default role: collaborator (leader/manager promoted manually or via edge function)
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'collaborator');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RLS POLICIES ============
-- PROFILES: everyone authenticated can read; user updates own; leader/manager can update any
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated USING (public.is_leader_or_manager(auth.uid()));
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id OR public.is_leader_or_manager(auth.uid()));

-- USER_ROLES: read for authenticated; only leader can modify
CREATE POLICY "roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_all_leader" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'leader')) WITH CHECK (public.has_role(auth.uid(), 'leader'));

-- TEAMS
CREATE POLICY "teams_select_auth" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams_modify_admin" ON public.teams FOR ALL TO authenticated
  USING (public.is_leader_or_manager(auth.uid())) WITH CHECK (public.is_leader_or_manager(auth.uid()));

-- TEAM_MEMBERS
CREATE POLICY "tm_select_auth" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "tm_modify_admin" ON public.team_members FOR ALL TO authenticated
  USING (public.is_leader_or_manager(auth.uid())) WITH CHECK (public.is_leader_or_manager(auth.uid()));

-- CLIENTS
CREATE POLICY "clients_select_auth" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_modify_admin" ON public.clients FOR ALL TO authenticated
  USING (public.is_leader_or_manager(auth.uid())) WITH CHECK (public.is_leader_or_manager(auth.uid()));

CREATE POLICY "ct_select_auth" ON public.client_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "ct_modify_admin" ON public.client_teams FOR ALL TO authenticated
  USING (public.is_leader_or_manager(auth.uid())) WITH CHECK (public.is_leader_or_manager(auth.uid()));

CREATE POLICY "csh_select_auth" ON public.client_satisfaction_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "csh_insert_admin" ON public.client_satisfaction_history FOR INSERT TO authenticated
  WITH CHECK (public.is_leader_or_manager(auth.uid()));

-- TASKS: all authenticated can read; any authenticated can create; assignee or creator or admin can update/delete
CREATE POLICY "tasks_select_auth" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_insert_auth" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by OR public.is_leader_or_manager(auth.uid()));
CREATE POLICY "tasks_update_auth" ON public.tasks FOR UPDATE TO authenticated
  USING (auth.uid() = assignee_id OR auth.uid() = created_by OR public.is_leader_or_manager(auth.uid()));
CREATE POLICY "tasks_delete_admin" ON public.tasks FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_leader_or_manager(auth.uid()));

-- COMMENTS
CREATE POLICY "comments_select_auth" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert_own" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_modify_own" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_own_or_admin" ON public.comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_leader_or_manager(auth.uid()));

-- TIME ENTRIES
CREATE POLICY "te_select_auth" ON public.time_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "te_insert_own" ON public.time_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "te_update_own" ON public.time_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "te_delete_own_or_admin" ON public.time_entries FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_leader_or_manager(auth.uid()));

-- FINANCE (leader/manager only)
CREATE POLICY "exp_admin" ON public.expenses FOR ALL TO authenticated
  USING (public.is_leader_or_manager(auth.uid())) WITH CHECK (public.is_leader_or_manager(auth.uid()));
CREATE POLICY "cash_admin" ON public.cash_adjustments FOR ALL TO authenticated
  USING (public.is_leader_or_manager(auth.uid())) WITH CHECK (public.is_leader_or_manager(auth.uid()));
CREATE POLICY "fset_admin" ON public.finance_settings FOR ALL TO authenticated
  USING (public.is_leader_or_manager(auth.uid())) WITH CHECK (public.is_leader_or_manager(auth.uid()));

-- NOTIFICATIONS (own only)
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_insert_admin" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_leader_or_manager(auth.uid()) OR auth.uid() = user_id);

-- ============ INDEXES ============
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_client ON public.tasks(client_id);
CREATE INDEX idx_tasks_team ON public.tasks(team_id);
CREATE INDEX idx_tm_user ON public.team_members(user_id);
CREATE INDEX idx_tm_team ON public.team_members(team_id);
CREATE INDEX idx_te_task ON public.time_entries(task_id);
CREATE INDEX idx_te_user ON public.time_entries(user_id);
