-- Ajustes de regra de acesso e vínculo de clientes/times.

-- 1) Financeiro: apenas líder pode acessar/editar
DROP POLICY IF EXISTS exp_admin ON public.expenses;
CREATE POLICY exp_admin ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'leader'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'leader'::app_role));

DROP POLICY IF EXISTS cash_admin ON public.cash_adjustments;
CREATE POLICY cash_admin ON public.cash_adjustments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'leader'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'leader'::app_role));

DROP POLICY IF EXISTS fset_admin ON public.finance_settings;
CREATE POLICY fset_admin ON public.finance_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'leader'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'leader'::app_role));

-- 2) Notificações: individuais por usuário (sem broadcast null)
DROP POLICY IF EXISTS notif_insert_admin ON public.notifications;
CREATE POLICY notif_insert_admin ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'leader'::app_role)
  );

-- 3) Correção do gatilho de limpeza de vínculo ao pausar/arquivar
CREATE OR REPLACE FUNCTION public.clear_client_links_on_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('paused','archived') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    DELETE FROM public.client_collaborators WHERE client_id = NEW.id;
    DELETE FROM public.client_teams WHERE client_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clear_client_links ON public.clients;
CREATE TRIGGER trg_clear_client_links
AFTER UPDATE OF status ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clear_client_links_on_status();
