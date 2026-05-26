-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.cash_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  amount numeric NOT NULL,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['in'::text, 'out'::text])),
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cash_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT cash_adjustments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.client_satisfaction_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  recorded_by uuid,
  CONSTRAINT client_satisfaction_history_pkey PRIMARY KEY (id),
  CONSTRAINT client_satisfaction_history_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT client_satisfaction_history_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.client_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  team_id uuid NOT NULL,
  CONSTRAINT client_teams_pkey PRIMARY KEY (id),
  CONSTRAINT client_teams_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT client_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text,
  status USER-DEFINED NOT NULL DEFAULT 'active'::client_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  phone text,
  contract_start date,
  contract_end date,
  monthly_value numeric,
  satisfaction integer CHECK (satisfaction >= 1 AND satisfaction <= 5),
  notes text,
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text NOT NULL,
  amount numeric NOT NULL,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  client_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.finance_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT finance_settings_pkey PRIMARY KEY (key)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  avatar_url text,
  phone text,
  bio text,
  position text,
  birth_date date,
  skills ARRAY DEFAULT '{}'::text[],
  hourly_rate numeric,
  contract_start date,
  contract_end date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status USER-DEFINED NOT NULL DEFAULT 'todo'::task_status,
  priority USER-DEFINED NOT NULL DEFAULT 'medium'::task_priority,
  client_id uuid,
  assignee_id uuid,
  due_date timestamp with time zone,
  total_seconds integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  team_id uuid,
  created_by uuid,
  recurrence jsonb,
  parent_task_id uuid,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT tasks_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.profiles(id),
  CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role_in_team USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT team_members_pkey PRIMARY KEY (id),
  CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#6366f1'::text,
  leader_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  started_at timestamp with time zone NOT NULL,
  ended_at timestamp with time zone,
  seconds integer NOT NULL DEFAULT 0,
  CONSTRAINT time_entries_pkey PRIMARY KEY (id),
  CONSTRAINT time_entries_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);