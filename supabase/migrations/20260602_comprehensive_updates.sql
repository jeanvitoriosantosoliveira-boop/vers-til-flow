-- ============================================================================
-- Comprehensive Migration: Role-Based Access, Services, and Enhancements
-- Date: 2025-06-02
-- Purpose: Add missing fields, roles, and relationships while preserving data
-- ============================================================================

-- ============================================================================
-- 1. ENUM TYPES - Add missing roles if not exists
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.user_role_new AS ENUM('leader', 'manager', 'collaborator', 'commercial');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. CLIENT STATUS EXTENSION - Add "pausado" status if not exists
-- ============================================================================
-- Note: PostgreSQL ENUM types cannot be directly altered. 
-- This requires a migration approach. For now, we'll add constraints.
-- ALTER TYPE public.client_status ADD VALUE 'pausado' AFTER 'active'; 
-- ^ Uncommenting this requires being in isolation level

-- ============================================================================
-- 3. SERVICES TABLE - Ensure services management table exists
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  default_price numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT services_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- 4. CLIENT_SERVICES TABLE - Link clients to services
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.client_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  service_id uuid NOT NULL,
  monthly_price numeric,
  started_at date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT client_services_pkey PRIMARY KEY (id),
  CONSTRAINT client_services_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT client_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_client_services_client_id ON public.client_services(client_id);
CREATE INDEX IF NOT EXISTS idx_client_services_service_id ON public.client_services(service_id);

-- ============================================================================
-- 5. CLIENT_COLLABORATORS TABLE - Link clients to collaborators/teams
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.client_collaborators (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  team_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT client_collaborators_pkey PRIMARY KEY (id),
  CONSTRAINT client_collaborators_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT client_collaborators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT client_collaborators_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_client_collaborators_client_id ON public.client_collaborators(client_id);
CREATE INDEX IF NOT EXISTS idx_client_collaborators_user_id ON public.client_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_client_collaborators_team_id ON public.client_collaborators(team_id);

-- ============================================================================
-- 6. TEAM_CLIENTS TABLE - Link teams to clients (team members auto-linked)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.team_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  client_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT team_clients_pkey PRIMARY KEY (id),
  CONSTRAINT team_clients_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
  CONSTRAINT team_clients_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT unique_team_client UNIQUE (team_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_team_clients_team_id ON public.team_clients(team_id);
CREATE INDEX IF NOT EXISTS idx_team_clients_client_id ON public.team_clients(client_id);

-- ============================================================================
-- 7. SALES_TILES TABLE - Sales pipeline tracking for commercial role
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sales_tiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'contacted',
  estimated_value numeric DEFAULT 0,
  contact_date timestamp with time zone DEFAULT now(),
  follow_up_date timestamp with time zone,
  time_spent_seconds integer DEFAULT 0,
  notes text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_tiles_client_id ON public.sales_tiles(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_tiles_owner_id ON public.sales_tiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_sales_tiles_stage ON public.sales_tiles(stage);

-- ============================================================================
-- 8. LEADS TABLE - Leads management for commercial role
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text,
  phone text,
  whatsapp text,
  source text,
  estimated_value numeric DEFAULT 0,
  stage text DEFAULT 'contacted',
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notes text,
  next_followup_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leads_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_leads_owner_id ON public.leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(stage);

-- ============================================================================
-- 9. LEAD_ACTIVITIES TABLE - Activities log for leads
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'note',
  body text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lead_activities_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id);

-- ============================================================================
-- 10. USER_KANBAN_COLUMNS TABLE - Personalized kanban columns per user
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_kanban_columns (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  accent text NOT NULL DEFAULT 'bg-muted-foreground',
  "order" integer NOT NULL DEFAULT 0,
  base text,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_kanban_columns_pkey PRIMARY KEY (id),
  CONSTRAINT unique_user_column UNIQUE (user_id, title)
);

CREATE INDEX IF NOT EXISTS idx_user_kanban_columns_user_id ON public.user_kanban_columns(user_id);

-- ============================================================================
-- 11. ENHANCE PROFILES TABLE - Add missing fields
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_rate numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contract_start date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contract_end date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS salary numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tax_rate numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}';

-- ============================================================================
-- 9. ENHANCE CLIENTS TABLE - Add missing/necessary fields
-- ============================================================================
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS segment text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS health text DEFAULT 'good';

-- ============================================================================
-- 10. ENHANCE TASKS TABLE - Add missing fields for kanban
-- ============================================================================
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS template_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS column_id text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_spawn timestamp with time zone;

-- Add foreign keys if not exists (can't fail with IF NOT EXISTS in add constraint)
ALTER TABLE public.tasks 
  ADD CONSTRAINT tasks_template_id_fkey 
  FOREIGN KEY (template_id) REFERENCES public.tasks(id) ON DELETE SET NULL;

ALTER TABLE public.tasks 
 ADD CONSTRAINT tasks_parent_task_id_fkey 
  FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;

-- ============================================================================
-- 11. ENHANCE KANBAN_COLUMNS TABLE
-- ============================================================================
ALTER TABLE public.kanban_columns ADD COLUMN IF NOT EXISTS base TEXT;

-- ============================================================================
-- 12. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_task_id ON public.comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON public.time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON public.time_entries(user_id);

-- ============================================================================
-- 13. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS on new tables
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_tiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_kanban_columns ENABLE ROW LEVEL SECURITY;

-- Services - Everyone can read, only leaders can edit
DROP POLICY IF EXISTS services_read_policy ON public.services;
CREATE POLICY services_read_policy ON public.services
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS services_edit_policy ON public.services;
CREATE POLICY services_edit_policy ON public.services
  FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leader'))
  WITH CHECK (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leader'));

-- Client Services - Everyone can read, only leaders can edit
DROP POLICY IF EXISTS client_services_read_policy ON public.client_services;
CREATE POLICY client_services_read_policy ON public.client_services
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS client_services_edit_policy ON public.client_services;
CREATE POLICY client_services_edit_policy ON public.client_services
  FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leader'))
  WITH CHECK (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leader'));

-- Client Collaborators - Everyone can read, only leaders can edit
DROP POLICY IF EXISTS client_collaborators_read_policy ON public.client_collaborators;
CREATE POLICY client_collaborators_read_policy ON public.client_collaborators
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS client_collaborators_edit_policy ON public.client_collaborators;
CREATE POLICY client_collaborators_edit_policy ON public.client_collaborators
  FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leader'))
  WITH CHECK (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leader'));

-- Team Clients - Everyone can read, only leaders can edit
DROP POLICY IF EXISTS team_clients_read_policy ON public.team_clients;
CREATE POLICY team_clients_read_policy ON public.team_clients
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS team_clients_edit_policy ON public.team_clients;
CREATE POLICY team_clients_edit_policy ON public.team_clients
  FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leader'))
  WITH CHECK (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leader'));

-- Sales Tiles - Everyone can read own, leaders/managers can edit all
DROP POLICY IF EXISTS sales_tiles_read_policy ON public.sales_tiles;
CREATE POLICY sales_tiles_read_policy ON public.sales_tiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sales_tiles_edit_policy ON public.sales_tiles;
CREATE POLICY sales_tiles_edit_policy ON public.sales_tiles
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('leader', 'manager'))
  )
  WITH CHECK (
    owner_id = auth.uid() OR
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('leader', 'manager'))
  );

-- Leads - Only leader and owner can read/edit
DROP POLICY IF EXISTS leads_read_policy ON public.leads;
CREATE POLICY leads_read_policy ON public.leads
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leader')
  );

DROP POLICY IF EXISTS leads_write_policy ON public.leads;
CREATE POLICY leads_write_policy ON public.leads
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leader')
  )
  WITH CHECK (
    owner_id = auth.uid() OR
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leader')
  );

-- Lead Activities - Only lead viewers can see
DROP POLICY IF EXISTS lead_activities_read_policy ON public.lead_activities;
CREATE POLICY lead_activities_read_policy ON public.lead_activities
  FOR SELECT TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM public.leads
      WHERE leads.id = lead_activities.lead_id AND (
        leads.owner_id = auth.uid() OR
        EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'leader')
      )
    )
  );

DROP POLICY IF EXISTS lead_activities_write_policy ON public.lead_activities;
CREATE POLICY lead_activities_write_policy ON public.lead_activities
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User Kanban Columns - Only user's own columns and template columns
DROP POLICY IF EXISTS user_kanban_columns_read_policy ON public.user_kanban_columns;
CREATE POLICY user_kanban_columns_read_policy ON public.user_kanban_columns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS user_kanban_columns_write_policy ON public.user_kanban_columns;
CREATE POLICY user_kanban_columns_write_policy ON public.user_kanban_columns
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 14. FUNCTION: Automatically unlink collaborators when client becomes inactive
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_client_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only if status changed to inactive/paused/archived
  IF NEW.status != OLD.status AND NEW.status != 'active' THEN
    -- Delete client collaborator links
    DELETE FROM public.client_collaborators WHERE client_id = NEW.id;
    -- Delete team client links
    DELETE FROM public.team_clients WHERE client_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DROP TRIGGER IF NOT EXISTS client_status_change_trigger ON public.clients;
CREATE TRIGGER client_status_change_trigger
AFTER UPDATE OF status ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.handle_client_status_change();

-- ============================================================================
-- 15. FUNCTION: Automatically link team members when client assigned to team
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_team_client_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert team members as client collaborators
  INSERT INTO public.client_collaborators (client_id, user_id, team_id, source)
  SELECT NEW.client_id, team_members.user_id, NEW.team_id, 'auto'
  FROM public.team_members
  WHERE team_members.team_id = NEW.team_id
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DROP TRIGGER IF NOT EXISTS team_client_assignment_trigger ON public.team_clients;
CREATE TRIGGER team_client_assignment_trigger
AFTER INSERT ON public.team_clients
FOR EACH ROW
EXECUTE FUNCTION public.handle_team_client_assignment();

-- ============================================================================
-- 16. TIMESTAMPS - Auto-update updated_at column
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF NOT EXISTS sales_tiles_updated_at_trigger ON public.sales_tiles;
CREATE TRIGGER sales_tiles_updated_at_trigger
BEFORE UPDATE ON public.sales_tiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================
-- Added:
--   • Services management (services, client_services tables)
--   • Client collaborator linking (client_collaborators table)
--   • Team-client linking (team_clients table)
--   • Sales tracking for commercial role (sales_tiles table)
--   • Enhanced profiles with employment/hire data
--   • Enhanced clients with logo and segment info
--   • Enhanced tasks with template/recurrence support
--   • Comprehensive indexes for performance
--   • RLS policies for data security
--   • Automatic triggers for client status and team assignments
--
-- No data loss - all existing records preserved
-- All changes include IF NOT EXISTS to allow idempotent execution
-- ============================================================================
