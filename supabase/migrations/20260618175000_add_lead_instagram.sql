-- Adiciona Instagram aos leads do funil comercial.
-- Incremental e sem perda de dados.

alter table public.leads
  add column if not exists instagram text;

create index if not exists idx_leads_instagram
  on public.leads(instagram)
  where instagram is not null;
