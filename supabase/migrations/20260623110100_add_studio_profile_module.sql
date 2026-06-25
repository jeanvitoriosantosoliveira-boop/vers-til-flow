-- Perfil e módulo Studio Fotográfico.
-- Este SQL mantém clientes, ensaios e financeiro do Studio em tabelas separadas.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'studio';

DO $$ BEGIN
  CREATE TYPE public.studio_shoot_type AS ENUM (
    'casal',
    'gestante',
    'corporativo',
    'individual',
    'familia',
    'casamento',
    'aniversario',
    'infantil',
    'empresarial',
    'parto',
    'sensual',
    'formatura',
    'produto'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_studio(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'studio'
  )
$$;

CREATE TABLE IF NOT EXISTS public.studio_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  cpf text,
  email text,
  phone text,
  address text,
  city text NOT NULL,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS studio_clients_touch ON public.studio_clients;
CREATE TRIGGER studio_clients_touch
  BEFORE UPDATE ON public.studio_clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS studio_clients_city_idx ON public.studio_clients(city);
CREATE INDEX IF NOT EXISTS studio_clients_created_by_idx ON public.studio_clients(created_by);

ALTER TABLE public.studio_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_clients access" ON public.studio_clients;
CREATE POLICY "studio_clients access" ON public.studio_clients
  FOR ALL TO authenticated
  USING (public.is_studio(auth.uid()) OR public.has_role(auth.uid(), 'leader'))
  WITH CHECK (public.is_studio(auth.uid()) OR public.has_role(auth.uid(), 'leader'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_clients TO authenticated;
GRANT ALL ON public.studio_clients TO service_role;

CREATE TABLE IF NOT EXISTS public.studio_shoots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.studio_clients(id) ON DELETE CASCADE,
  city text NOT NULL,
  shoot_type public.studio_shoot_type NOT NULL,
  shoot_date date,
  photos_delivered integer NOT NULL DEFAULT 0 CHECK (photos_delivered >= 0),
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS studio_shoots_touch ON public.studio_shoots;
CREATE TRIGGER studio_shoots_touch
  BEFORE UPDATE ON public.studio_shoots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS studio_shoots_client_idx ON public.studio_shoots(client_id);
CREATE INDEX IF NOT EXISTS studio_shoots_city_idx ON public.studio_shoots(city);
CREATE INDEX IF NOT EXISTS studio_shoots_type_idx ON public.studio_shoots(shoot_type);
CREATE INDEX IF NOT EXISTS studio_shoots_created_by_idx ON public.studio_shoots(created_by);

ALTER TABLE public.studio_shoots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "studio_shoots access" ON public.studio_shoots;
CREATE POLICY "studio_shoots access" ON public.studio_shoots
  FOR ALL TO authenticated
  USING (public.is_studio(auth.uid()) OR public.has_role(auth.uid(), 'leader'))
  WITH CHECK (public.is_studio(auth.uid()) OR public.has_role(auth.uid(), 'leader'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_shoots TO authenticated;
GRANT ALL ON public.studio_shoots TO service_role;

ALTER TABLE public.studio_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "studio_sessions access" ON public.studio_sessions;
CREATE POLICY "studio_sessions access" ON public.studio_sessions
  FOR ALL TO authenticated
  USING (public.is_studio(auth.uid()) OR public.has_role(auth.uid(), 'leader'))
  WITH CHECK (public.is_studio(auth.uid()) OR public.has_role(auth.uid(), 'leader'));

ALTER TABLE public.studio_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "studio_expenses access" ON public.studio_expenses;
CREATE POLICY "studio_expenses access" ON public.studio_expenses
  FOR ALL TO authenticated
  USING (public.is_studio(auth.uid()) OR public.has_role(auth.uid(), 'leader'))
  WITH CHECK (public.is_studio(auth.uid()) OR public.has_role(auth.uid(), 'leader'));
