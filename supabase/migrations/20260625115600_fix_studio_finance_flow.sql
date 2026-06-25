-- Corrige o fluxo do Studio para clientes, ensaios, filtros e financeiro usarem as mesmas tabelas.

ALTER TABLE public.studio_clients
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'lead';

ALTER TABLE public.studio_clients
  ADD COLUMN IF NOT EXISTS business_value numeric;

ALTER TABLE public.studio_clients
  DROP CONSTRAINT IF EXISTS studio_clients_status_check;

ALTER TABLE public.studio_clients
  ADD CONSTRAINT studio_clients_status_check
  CHECK (status IN ('lead', 'budget', 'active', 'completed', 'archived'));

CREATE INDEX IF NOT EXISTS studio_clients_status_idx ON public.studio_clients(status);
CREATE INDEX IF NOT EXISTS studio_clients_business_value_idx ON public.studio_clients(business_value);

ALTER TABLE public.studio_shoots
  ADD COLUMN IF NOT EXISTS business_value numeric NOT NULL DEFAULT 0;

ALTER TABLE public.studio_shoots
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.studio_shoots
  DROP CONSTRAINT IF EXISTS studio_shoots_payment_status_check;

ALTER TABLE public.studio_shoots
  ADD CONSTRAINT studio_shoots_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'canceled'));

CREATE INDEX IF NOT EXISTS studio_shoots_business_value_idx ON public.studio_shoots(business_value);
CREATE INDEX IF NOT EXISTS studio_shoots_payment_status_idx ON public.studio_shoots(payment_status);
