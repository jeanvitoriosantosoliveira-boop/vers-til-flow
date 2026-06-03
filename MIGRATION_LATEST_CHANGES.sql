-- ============================================================
-- MIGRATION: Latest Changes - Leads, Kanban, and Commercial Features
-- Run this script in Supabase SQL Editor
-- Date: June 2, 2026
-- ============================================================

-- 1. Ensure 'commercial' role is added to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'commercial';

-- 2. Create helper function for checking commercial role
CREATE OR REPLACE FUNCTION public.is_commercial(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'commercial')
$$;

-- =========================================================
-- LEAD STAGES (Sales pipeline stages)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.lead_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  position integer NOT NULL DEFAULT 0,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_stages TO authenticated;
GRANT ALL ON public.lead_stages TO service_role;
ALTER TABLE public.lead_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ls_select ON public.lead_stages;
CREATE POLICY ls_select ON public.lead_stages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS ls_modify ON public.lead_stages;
CREATE POLICY ls_modify ON public.lead_stages FOR ALL TO authenticated
  USING (public.is_leader_or_manager(auth.uid())) WITH CHECK (public.is_leader_or_manager(auth.uid()));

-- Seed default lead stages
INSERT INTO public.lead_stages (name, color, position, is_won, is_lost) VALUES
  ('Novo Lead', '#3b82f6', 0, false, false),
  ('Abordagem', '#8b5cf6', 1, false, false),
  ('Follow-up', '#f59e0b', 2, false, false),
  ('Proposta', '#0ea5e9', 3, false, false),
  ('Negociação', '#ec4899', 4, false, false),
  ('Ganho', '#10b981', 5, true, false),
  ('Perdido', '#ef4444', 6, false, true)
ON CONFLICT DO NOTHING;

-- =========================================================
-- LEADS (Sales/Commercial contacts)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text,
  phone text,
  whatsapp text,
  source text,
  estimated_value numeric DEFAULT 0,
  stage_id uuid REFERENCES public.lead_stages(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  next_followup_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_owner_id ON public.leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON public.leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_select ON public.leads;
CREATE POLICY leads_select ON public.leads FOR SELECT TO authenticated USING (
  public.is_leader_or_manager(auth.uid()) OR owner_id = auth.uid() OR public.is_commercial(auth.uid())
);

DROP POLICY IF EXISTS leads_insert ON public.leads;
CREATE POLICY leads_insert ON public.leads FOR INSERT TO authenticated WITH CHECK (
  public.is_leader_or_manager(auth.uid()) OR public.is_commercial(auth.uid())
);

DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_update ON public.leads FOR UPDATE TO authenticated USING (
  public.is_leader_or_manager(auth.uid()) OR owner_id = auth.uid()
);

DROP POLICY IF EXISTS leads_delete ON public.leads;
CREATE POLICY leads_delete ON public.leads FOR DELETE TO authenticated USING (
  public.is_leader_or_manager(auth.uid()) OR owner_id = auth.uid()
);

-- Auto-update timestamp on leads change
DROP TRIGGER IF EXISTS trg_leads_updated ON public.leads;
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- LEAD ACTIVITIES (Follow-ups, calls, emails, notes)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'note', -- note|call|email|whatsapp|meeting
  body text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_user_id ON public.lead_activities(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
GRANT ALL ON public.lead_activities TO service_role;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS la_select ON public.lead_activities;
CREATE POLICY la_select ON public.lead_activities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS la_insert ON public.lead_activities;
CREATE POLICY la_insert ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() OR public.is_leader_or_manager(auth.uid())
);

DROP POLICY IF EXISTS la_update ON public.lead_activities;
CREATE POLICY la_update ON public.lead_activities FOR UPDATE TO authenticated USING (
  user_id = auth.uid() OR public.is_leader_or_manager(auth.uid())
);

DROP POLICY IF EXISTS la_delete ON public.lead_activities;
CREATE POLICY la_delete ON public.lead_activities FOR DELETE TO authenticated USING (
  user_id = auth.uid() OR public.is_leader_or_manager(auth.uid())
);

-- =========================================================
-- USER KANBAN COLUMNS (Personalized kanban columns per user)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_kanban_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  accent text DEFAULT '#6366f1',
  position integer NOT NULL DEFAULT 0,
  base text DEFAULT 'custom',
  is_custom boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title)
);

CREATE INDEX IF NOT EXISTS idx_user_kanban_columns_user_id ON public.user_kanban_columns(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_kanban_columns TO authenticated;
GRANT ALL ON public.user_kanban_columns TO service_role;
ALTER TABLE public.user_kanban_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ukc_select ON public.user_kanban_columns;
CREATE POLICY ukc_select ON public.user_kanban_columns FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.is_leader_or_manager(auth.uid())
);

DROP POLICY IF EXISTS ukc_insert ON public.user_kanban_columns;
CREATE POLICY ukc_insert ON public.user_kanban_columns FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() OR public.is_leader_or_manager(auth.uid())
);

DROP POLICY IF EXISTS ukc_update ON public.user_kanban_columns;
CREATE POLICY ukc_update ON public.user_kanban_columns FOR UPDATE TO authenticated USING (
  user_id = auth.uid() OR public.is_leader_or_manager(auth.uid())
);

DROP POLICY IF EXISTS ukc_delete ON public.user_kanban_columns;
CREATE POLICY ukc_delete ON public.user_kanban_columns FOR DELETE TO authenticated USING (
  user_id = auth.uid() OR public.is_leader_or_manager(auth.uid())
);

-- Auto-update timestamp on kanban column change
DROP TRIGGER IF EXISTS trg_user_kanban_columns_updated ON public.user_kanban_columns;
CREATE TRIGGER trg_user_kanban_columns_updated BEFORE UPDATE ON public.user_kanban_columns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- SUMMARY OF CHANGES
-- =========================================================
-- ✅ Added lead_stages table with default sales pipeline stages
-- ✅ Added leads table with owner_id (commercial assigned), stage_id, and follow-up tracking
-- ✅ Added lead_activities table for tracking interactions (calls, emails, notes, meetings)
-- ✅ Added user_kanban_columns table for future personalized kanban implementation
-- ✅ Added is_commercial() helper function for role checking
-- ✅ All tables have RLS policies for role-based access control
-- ✅ Indexes created for performance on foreign keys and frequent queries
-- ✅ All new tables enabled for authenticated users

-- Frontend Impact:
-- - /leads page created for managing sales leads with full CRUD
-- - Commercial users can now manage their assigned leads
-- - Leaders/managers can see all leads and manage entire pipeline
-- - Reports now hide financial data (Mensalidade/Receita) from non-leaders
-- - Avatar display in Profile verified working correctly
-- - Password handling verified secure (no plaintext storage)
-- - "Ganhos do mês" renamed to "Vendidos" in SalesDashboard
-- - Commercial users redirected away from task kanban to sales dashboard
