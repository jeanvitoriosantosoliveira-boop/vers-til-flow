
-- 1. Add 'commercial' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'commercial';

-- Helper functions (declared in separate statement so new enum value is usable in next migration but functions only reference text equality, OK now)
CREATE OR REPLACE FUNCTION public.is_commercial(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'commercial')
$$;

-- =========================================================
-- STUDIO
-- =========================================================
CREATE TABLE IF NOT EXISTS public.studio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist_name text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time time,
  hours numeric NOT NULL DEFAULT 1,
  hourly_rate numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending', -- pending|paid|canceled
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_sessions TO authenticated;
GRANT ALL ON public.studio_sessions TO service_role;
ALTER TABLE public.studio_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY studio_sessions_leader ON public.studio_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'leader')) WITH CHECK (public.has_role(auth.uid(),'leader'));
CREATE TRIGGER trg_studio_sessions_updated BEFORE UPDATE ON public.studio_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.studio_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  amount numeric NOT NULL DEFAULT 0,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_expenses TO authenticated;
GRANT ALL ON public.studio_expenses TO service_role;
ALTER TABLE public.studio_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY studio_expenses_leader ON public.studio_expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'leader')) WITH CHECK (public.has_role(auth.uid(),'leader'));

-- =========================================================
-- SALES / CRM
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
CREATE POLICY ls_select ON public.lead_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY ls_modify ON public.lead_stages FOR ALL TO authenticated
  USING (public.is_leader_or_manager(auth.uid())) WITH CHECK (public.is_leader_or_manager(auth.uid()));

INSERT INTO public.lead_stages (name, color, position, is_won, is_lost) VALUES
  ('Novo Lead', '#3b82f6', 0, false, false),
  ('Abordagem', '#8b5cf6', 1, false, false),
  ('Follow-up', '#f59e0b', 2, false, false),
  ('Proposta', '#0ea5e9', 3, false, false),
  ('Negociação', '#ec4899', 4, false, false),
  ('Ganho', '#10b981', 5, true, false),
  ('Perdido', '#ef4444', 6, false, true)
ON CONFLICT DO NOTHING;

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_select ON public.leads FOR SELECT TO authenticated USING (
  public.is_leader_or_manager(auth.uid()) OR owner_id = auth.uid() OR public.is_commercial(auth.uid())
);
CREATE POLICY leads_insert ON public.leads FOR INSERT TO authenticated WITH CHECK (
  public.is_leader_or_manager(auth.uid()) OR public.is_commercial(auth.uid())
);
CREATE POLICY leads_update ON public.leads FOR UPDATE TO authenticated USING (
  public.is_leader_or_manager(auth.uid()) OR owner_id = auth.uid()
);
CREATE POLICY leads_delete ON public.leads FOR DELETE TO authenticated USING (
  public.is_leader_or_manager(auth.uid()) OR owner_id = auth.uid()
);
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'note', -- note|call|email|whatsapp|meeting
  body text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
GRANT ALL ON public.lead_activities TO service_role;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY la_select ON public.lead_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY la_insert ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() OR public.is_leader_or_manager(auth.uid())
);
CREATE POLICY la_update ON public.lead_activities FOR UPDATE TO authenticated USING (
  user_id = auth.uid() OR public.is_leader_or_manager(auth.uid())
);
CREATE POLICY la_delete ON public.lead_activities FOR DELETE TO authenticated USING (
  user_id = auth.uid() OR public.is_leader_or_manager(auth.uid())
);

CREATE TABLE IF NOT EXISTS public.sales_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'meeting', -- call|meeting|task|other
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  location text,
  link text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_events TO authenticated;
GRANT ALL ON public.sales_events TO service_role;
ALTER TABLE public.sales_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY se_select ON public.sales_events FOR SELECT TO authenticated USING (
  public.is_leader_or_manager(auth.uid()) OR owner_id = auth.uid() OR public.is_commercial(auth.uid())
);
CREATE POLICY se_modify ON public.sales_events FOR ALL TO authenticated USING (
  owner_id = auth.uid() OR public.is_leader_or_manager(auth.uid())
) WITH CHECK (
  owner_id = auth.uid() OR public.is_leader_or_manager(auth.uid())
);

-- =========================================================
-- finance_settings: allow leader-only update for cash override (already admin policy in place)
-- =========================================================
