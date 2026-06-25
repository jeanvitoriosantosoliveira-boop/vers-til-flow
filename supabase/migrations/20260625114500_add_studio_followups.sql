-- Complementa o módulo Studio com tipo de ensaio no cliente e follow up de orçamentos.

ALTER TABLE public.studio_clients
  ADD COLUMN IF NOT EXISTS shoot_type public.studio_shoot_type;

CREATE INDEX IF NOT EXISTS studio_clients_shoot_type_idx ON public.studio_clients(shoot_type);

CREATE TABLE IF NOT EXISTS public.studio_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  city text NOT NULL,
  desired_shoot_type public.studio_shoot_type NOT NULL,
  estimated_value numeric,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'lost', 'converted')),
  follow_up_date date,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS studio_followups_touch ON public.studio_followups;
CREATE TRIGGER studio_followups_touch
  BEFORE UPDATE ON public.studio_followups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS studio_followups_city_idx ON public.studio_followups(city);
CREATE INDEX IF NOT EXISTS studio_followups_type_idx ON public.studio_followups(desired_shoot_type);
CREATE INDEX IF NOT EXISTS studio_followups_status_idx ON public.studio_followups(status);
CREATE INDEX IF NOT EXISTS studio_followups_follow_up_date_idx ON public.studio_followups(follow_up_date);
CREATE INDEX IF NOT EXISTS studio_followups_created_by_idx ON public.studio_followups(created_by);

ALTER TABLE public.studio_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_followups access" ON public.studio_followups;
CREATE POLICY "studio_followups access" ON public.studio_followups
  FOR ALL TO authenticated
  USING (public.is_studio(auth.uid()) OR public.has_role(auth.uid(), 'leader'))
  WITH CHECK (public.is_studio(auth.uid()) OR public.has_role(auth.uid(), 'leader'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_followups TO authenticated;
GRANT ALL ON public.studio_followups TO service_role;
