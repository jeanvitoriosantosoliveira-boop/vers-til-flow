-- Atualizacao incremental para permissoes, comercial, vinculos e realtime.
-- Seguro para rodar sobre a base atual: nao remove dados de negocio existentes.

create extension if not exists pgcrypto;

-- Campos comerciais usados pelo funil de vendas.
alter table public.leads add column if not exists niche text;
alter table public.leads add column if not exists time_spent_seconds integer not null default 0;
alter table public.leads add column if not exists won_at timestamp with time zone;

-- Tabelas complementares informadas no schema atual.
create table if not exists public.team_clients (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamp with time zone default now()
);

create table if not exists public.sales_tiles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  stage text default 'contacted'::text,
  estimated_value numeric default 0,
  contact_date timestamp with time zone default now(),
  follow_up_date timestamp with time zone,
  time_spent_seconds integer default 0,
  notes text,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.user_kanban_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  accent text default '#6366f1'::text,
  position integer not null default 0,
  base text default 'custom'::text,
  is_custom boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Indices/constraints nao destrutivos para evitar duplicidades futuras.
create unique index if not exists team_members_team_user_idx on public.team_members(team_id, user_id);
create unique index if not exists team_clients_team_client_idx on public.team_clients(team_id, client_id);
create unique index if not exists client_services_client_service_idx on public.client_services(client_id, service_id);
create unique index if not exists client_collaborators_team_unique_idx
  on public.client_collaborators(client_id, user_id, team_id)
  where source = 'team' and team_id is not null;
-- Corrige papeis duplicados mantendo o nivel mais alto por usuario.
with ranked_roles as (
  select
    id,
    user_id,
    role,
    row_number() over (
      partition by user_id
      order by case role
        when 'leader' then 1
        when 'manager' then 2
        when 'commercial' then 3
        else 4
      end, created_at desc
    ) as rn
  from public.user_roles
)
delete from public.user_roles ur
using ranked_roles rr
where ur.id = rr.id
  and rr.rn > 1;

create unique index if not exists user_roles_user_unique_idx on public.user_roles(user_id);

-- Garante etapa fixa de vendido e evita duplicidade por nome antes do indice unico.
do $$
declare
  kept_id uuid;
  dup record;
begin
  for dup in
    select lower(name) as stage_name, min(id::text)::uuid as keep_id
    from public.lead_stages
    group by lower(name)
    having count(*) > 1
  loop
    update public.leads
      set stage_id = dup.keep_id
      where stage_id in (
        select id from public.lead_stages
        where lower(name) = dup.stage_name and id <> dup.keep_id
      );

    delete from public.lead_stages
      where lower(name) = dup.stage_name and id <> dup.keep_id;
  end loop;

  select id into kept_id
  from public.lead_stages
  where is_won = true
  order by position
  limit 1;

  if kept_id is null then
    insert into public.lead_stages(name, color, position, is_won, is_lost)
    values ('Vendido', '#22c55e', 999, true, false);
  else
    update public.lead_stages
      set name = 'Vendido', is_won = true, is_lost = false
      where id = kept_id;
  end if;
end $$;

create unique index if not exists lead_stages_name_unique_idx on public.lead_stages(lower(name));

-- Helpers de papel.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_leader(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.has_role(_user_id, 'leader'::public.app_role); $$;

create or replace function public.is_commercial(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.has_role(_user_id, 'commercial'::public.app_role); $$;

-- Atualiza updated_at/won_at dos leads.
create or replace function public.touch_lead_sales_fields()
returns trigger
language plpgsql
as $$
declare
  new_is_won boolean;
begin
  new.updated_at = now();

  select coalesce(is_won, false)
    into new_is_won
  from public.lead_stages
  where id = new.stage_id;

  if new_is_won and old.stage_id is distinct from new.stage_id then
    new.won_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_touch_lead_sales_fields on public.leads;
create trigger trg_touch_lead_sales_fields
before update on public.leads
for each row execute function public.touch_lead_sales_fields();

-- Sincroniza time -> cliente -> colaboradores.
create or replace function public.sync_team_client_collaborators()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.client_collaborators(client_id, user_id, team_id, source)
    select new.client_id, tm.user_id, new.team_id, 'team'
    from public.team_members tm
    join public.clients c on c.id = new.client_id and c.status = 'active'
    where tm.team_id = new.team_id
    on conflict do nothing;
    return new;
  elsif tg_op = 'DELETE' then
    delete from public.client_collaborators
    where client_id = old.client_id
      and team_id = old.team_id
      and source = 'team';
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_team_client_collaborators on public.team_clients;
create trigger trg_sync_team_client_collaborators
after insert or delete on public.team_clients
for each row execute function public.sync_team_client_collaborators();

create or replace function public.sync_team_member_clients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.client_collaborators(client_id, user_id, team_id, source)
    select tc.client_id, new.user_id, new.team_id, 'team'
    from public.team_clients tc
    join public.clients c on c.id = tc.client_id and c.status = 'active'
    where tc.team_id = new.team_id
    on conflict do nothing;
    return new;
  elsif tg_op = 'DELETE' then
    delete from public.client_collaborators
    where user_id = old.user_id
      and team_id = old.team_id
      and source = 'team';
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_team_member_clients on public.team_members;
create trigger trg_sync_team_member_clients
after insert or delete on public.team_members
for each row execute function public.sync_team_member_clients();

-- Cliente pausado/inativo/arquivado deixa de aparecer vinculado.
create or replace function public.unlink_inactive_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'active' then
    delete from public.client_collaborators where client_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_unlink_inactive_client on public.clients;
create trigger trg_unlink_inactive_client
after update of status on public.clients
for each row
when (old.status is distinct from new.status)
execute function public.unlink_inactive_client();

-- Bucket publico para avatares.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars_public_read') then
    create policy avatars_public_read on storage.objects for select using (bucket_id = 'avatars');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars_user_write_own_folder') then
    create policy avatars_user_write_own_folder on storage.objects for all
      using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
      with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
end $$;

-- Realtime nas tabelas usadas em telas ao vivo.
do $$
declare
  t text;
  tables text[] := array[
    'tasks','kanban_columns','clients','comments','time_entries','notifications',
    'leads','lead_stages','lead_activities','sales_events','team_clients',
    'team_members','client_collaborators','client_services','finance_settings',
    'cash_adjustments','expenses','extra_services'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- RLS e politicas principais. As politicas sao criadas apenas se ainda nao existirem.
alter table public.notifications enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.sales_events enable row level security;
alter table public.finance_settings enable row level security;
alter table public.cash_adjustments enable row level security;
alter table public.expenses enable row level security;
alter table public.extra_services enable row level security;
alter table public.team_clients enable row level security;
alter table public.client_collaborators enable row level security;
alter table public.client_services enable row level security;
alter table public.services enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_select_own') then
    create policy notifications_select_own on public.notifications for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_update_own') then
    create policy notifications_update_own on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_delete_own') then
    create policy notifications_delete_own on public.notifications for delete using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_insert_authenticated') then
    create policy notifications_insert_authenticated on public.notifications for insert with check (auth.uid() is not null);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='leads' and policyname='leads_leader_all_or_owner') then
    create policy leads_leader_all_or_owner on public.leads for all
      using (public.is_leader(auth.uid()) or owner_id = auth.uid())
      with check (public.is_leader(auth.uid()) or owner_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_activities' and policyname='lead_activities_by_visible_lead') then
    create policy lead_activities_by_visible_lead on public.lead_activities for all
      using (
        public.is_leader(auth.uid()) or exists (
          select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid()
        )
      )
      with check (
        public.is_leader(auth.uid()) or exists (
          select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sales_events' and policyname='sales_events_leader_all_or_owner') then
    create policy sales_events_leader_all_or_owner on public.sales_events for all
      using (public.is_leader(auth.uid()) or owner_id = auth.uid())
      with check (public.is_leader(auth.uid()) or owner_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='finance_settings' and policyname='finance_leader_all') then
    create policy finance_leader_all on public.finance_settings for all using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cash_adjustments' and policyname='cash_leader_all') then
    create policy cash_leader_all on public.cash_adjustments for all using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='expenses' and policyname='expenses_leader_all') then
    create policy expenses_leader_all on public.expenses for all using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='extra_services' and policyname='extra_services_leader_all') then
    create policy extra_services_leader_all on public.extra_services for all using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='services' and policyname='services_visible_authenticated') then
    create policy services_visible_authenticated on public.services for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='services' and policyname='services_leader_write') then
    create policy services_leader_write on public.services for all using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_services' and policyname='client_services_visible_authenticated') then
    create policy client_services_visible_authenticated on public.client_services for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_services' and policyname='client_services_leader_write') then
    create policy client_services_leader_write on public.client_services for all using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_clients' and policyname='team_clients_manager_write') then
    create policy team_clients_manager_write on public.team_clients for all
      using (public.is_leader(auth.uid()) or public.has_role(auth.uid(), 'manager'::public.app_role))
      with check (public.is_leader(auth.uid()) or public.has_role(auth.uid(), 'manager'::public.app_role));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_collaborators' and policyname='client_collaborators_visible_related') then
    create policy client_collaborators_visible_related on public.client_collaborators for select
      using (public.is_leader(auth.uid()) or user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_collaborators' and policyname='client_collaborators_manager_write') then
    create policy client_collaborators_manager_write on public.client_collaborators for all
      using (public.is_leader(auth.uid()) or public.has_role(auth.uid(), 'manager'::public.app_role))
      with check (public.is_leader(auth.uid()) or public.has_role(auth.uid(), 'manager'::public.app_role));
  end if;
end $$;
