-- Garante que o lider possa persistir o valor manual do caixa em finance_settings.

alter table public.finance_settings enable row level security;

drop policy if exists finance_leader_all on public.finance_settings;

create policy finance_leader_all
on public.finance_settings
for all
to authenticated
using (public.has_role(auth.uid(), 'leader'))
with check (public.has_role(auth.uid(), 'leader'));

grant select, insert, update, delete
on public.finance_settings
to authenticated;
