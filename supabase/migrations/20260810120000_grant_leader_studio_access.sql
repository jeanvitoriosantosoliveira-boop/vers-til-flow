-- Garante acesso integral do perfil Studio e do lider ao modulo Studio.
-- Demais perfis continuam sem permissao nas tabelas studio_*.

create or replace function public.is_studio(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role::text = 'studio'
  );
$$;

revoke execute on function public.is_studio(uuid) from public, anon;
grant execute on function public.is_studio(uuid) to authenticated;

alter table public.studio_clients enable row level security;
drop policy if exists "studio_clients access" on public.studio_clients;
create policy "studio_clients access"
on public.studio_clients
for all
to authenticated
using (public.is_studio(auth.uid()) or public.has_role(auth.uid(), 'leader'))
with check (public.is_studio(auth.uid()) or public.has_role(auth.uid(), 'leader'));

alter table public.studio_shoots enable row level security;
drop policy if exists "studio_shoots access" on public.studio_shoots;
create policy "studio_shoots access"
on public.studio_shoots
for all
to authenticated
using (public.is_studio(auth.uid()) or public.has_role(auth.uid(), 'leader'))
with check (public.is_studio(auth.uid()) or public.has_role(auth.uid(), 'leader'));

alter table public.studio_followups enable row level security;
drop policy if exists "studio_followups access" on public.studio_followups;
create policy "studio_followups access"
on public.studio_followups
for all
to authenticated
using (public.is_studio(auth.uid()) or public.has_role(auth.uid(), 'leader'))
with check (public.is_studio(auth.uid()) or public.has_role(auth.uid(), 'leader'));

alter table public.studio_sessions enable row level security;
drop policy if exists studio_sessions_leader on public.studio_sessions;
drop policy if exists "studio_sessions access" on public.studio_sessions;
create policy "studio_sessions access"
on public.studio_sessions
for all
to authenticated
using (public.is_studio(auth.uid()) or public.has_role(auth.uid(), 'leader'))
with check (public.is_studio(auth.uid()) or public.has_role(auth.uid(), 'leader'));

alter table public.studio_expenses enable row level security;
drop policy if exists studio_expenses_leader on public.studio_expenses;
drop policy if exists "studio_expenses access" on public.studio_expenses;
create policy "studio_expenses access"
on public.studio_expenses
for all
to authenticated
using (public.is_studio(auth.uid()) or public.has_role(auth.uid(), 'leader'))
with check (public.is_studio(auth.uid()) or public.has_role(auth.uid(), 'leader'));

grant select, insert, update, delete
on public.studio_clients,
   public.studio_shoots,
   public.studio_followups,
   public.studio_sessions,
   public.studio_expenses
to authenticated;
