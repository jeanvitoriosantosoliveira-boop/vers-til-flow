-- Impede que mais de uma sessao gere a mesma ocorrencia recorrente.
-- A aplicacao passa a inserir cada ocorrencia em tasks antes de exibi-la.

create unique index if not exists tasks_template_due_unique_idx
  on public.tasks (template_id, due_date)
  where template_id is not null
    and due_date is not null;

create index if not exists tasks_recurring_templates_idx
  on public.tasks (is_template, last_spawn)
  where is_template = true;
