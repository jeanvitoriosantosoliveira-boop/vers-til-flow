-- SQL Changes Summary - What's Being Added to Your Database
-- Run this script in Supabase SQL Editor

-- NEW TABLE 1: Services management
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  default_price numeric,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- NEW TABLE 2: Link clients to services (what each client has contracted)
CREATE TABLE IF NOT EXISTS public.client_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  monthly_price numeric,
  started_at date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now()
);

-- NEW TABLE 3: Link clients to collaborators (who works on each client)
CREATE TABLE IF NOT EXISTS public.client_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text DEFAULT 'manual',
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- NEW TABLE 4: Link teams to clients (auto-links team members)
CREATE TABLE IF NOT EXISTS public.team_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (team_id, client_id)
);

-- NEW TABLE 5: Sales/Commercial tracking
CREATE TABLE IF NOT EXISTS public.sales_tiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stage text DEFAULT 'contacted',
  estimated_value numeric DEFAULT 0,
  contact_date timestamp with time zone DEFAULT now(),
  follow_up_date timestamp with time zone,
  time_spent_seconds integer DEFAULT 0,
  notes text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ENHANCE: Profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_rate numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contract_start date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contract_end date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS salary numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tax_rate numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}';

-- ENHANCE: Clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS segment text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS health text DEFAULT 'good';

-- ENHANCE: Tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS template_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS column_id text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_spawn timestamp with time zone;

-- ENHANCE: Kanban columns
ALTER TABLE public.kanban_columns ADD COLUMN IF NOT EXISTS base TEXT;

-- CREATE INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_client_services_client_id ON public.client_services(client_id);
CREATE INDEX IF NOT EXISTS idx_client_collaborators_client_id ON public.client_collaborators(client_id);
CREATE INDEX IF NOT EXISTS idx_team_clients_team_id ON public.team_clients(team_id);
CREATE INDEX IF NOT EXISTS idx_sales_tiles_client_id ON public.sales_tiles(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_tiles_owner_id ON public.sales_tiles(owner_id);

-- ENABLE RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_tiles ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (everyone reads services, only leaders edit)
DROP POLICY IF EXISTS services_read ON public.services;
CREATE POLICY services_read ON public.services
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS services_write ON public.services;
CREATE POLICY services_write ON public.services
  FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='leader'))
  WITH CHECK (EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='leader'));

-- AUTO-TRIGGER: When client status changes to inactive, unlink collaborators
CREATE OR REPLACE FUNCTION public.handle_client_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status AND NEW.status != 'active' THEN
    DELETE FROM public.client_collaborators WHERE client_id = NEW.id;
    DELETE FROM public.team_clients WHERE client_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_status_change_trigger ON public.clients;
CREATE TRIGGER client_status_change_trigger
AFTER UPDATE OF status ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.handle_client_status_change();

-- AUTO-TRIGGER: When team assigned to client, auto-link team members
CREATE OR REPLACE FUNCTION public.handle_team_client_assignment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.client_collaborators (client_id, user_id, team_id, source)
  SELECT NEW.client_id, user_id, NEW.team_id, 'auto'
  FROM public.team_members WHERE team_id = NEW.team_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS team_client_assignment_trigger ON public.team_clients;
CREATE TRIGGER team_client_assignment_trigger
AFTER INSERT ON public.team_clients
FOR EACH ROW EXECUTE FUNCTION public.handle_team_client_assignment();

-- RESULT: All new tables created, enhancements applied, triggers set up
-- No data loss - all existing records preserved!
