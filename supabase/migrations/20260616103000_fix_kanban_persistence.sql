-- Correcao incremental de persistencia do Kanban.
-- Nao remove dados. Ajusta RLS/policies para permitir salvar tarefas, colunas,
-- comentarios e apontamentos de tempo conforme o usuario autenticado.

create extension if not exists pgcrypto;

-- Helpers defensivos para ambientes onde a funcao antiga nao existe ou ficou divergente.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
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
      and role = _role
  );
$$;

create or replace function public.is_leader_or_manager(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'leader'::public.app_role)
      or public.has_role(_user_id, 'manager'::public.app_role);
$$;

-- updated_at automatico para tarefas.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tasks_updated on public.tasks;
create trigger trg_tasks_updated
before update on public.tasks
for each row execute function public.set_updated_at();

-- Garante as colunas padrao no banco. Elas usam status/base e nao sobrescrevem colunas existentes.
insert into public.kanban_columns (id, title, accent, "order", base)
values
  ('todo', 'A Fazer', 'bg-muted-foreground', 0, 'todo'),
  ('in_progress', 'Em Andamento', 'bg-primary', 1, 'in_progress'),
  ('review', 'Em Revisao', 'bg-warning', 2, 'review'),
  ('done', 'Concluido', 'bg-success', 3, 'done')
on conflict (id) do nothing;

-- Ativa RLS nas tabelas do Kanban.
alter table public.tasks enable row level security;
alter table public.kanban_columns enable row level security;
alter table public.comments enable row level security;
alter table public.time_entries enable row level security;
alter table public.notifications enable row level security;

-- Troca policies antigas por regras consistentes.
drop policy if exists "tasks_select_auth" on public.tasks;
drop policy if exists "tasks_insert_auth" on public.tasks;
drop policy if exists "tasks_update_auth" on public.tasks;
drop policy if exists "tasks_delete_admin" on public.tasks;
drop policy if exists tasks_select_authenticated on public.tasks;
drop policy if exists tasks_insert_authenticated on public.tasks;
drop policy if exists tasks_update_related_or_manager on public.tasks;
drop policy if exists tasks_delete_related_or_manager on public.tasks;

create policy tasks_select_authenticated
on public.tasks
for select
to authenticated
using (auth.uid() is not null);

create policy tasks_insert_authenticated
on public.tasks
for insert
to authenticated
with check (
  auth.uid() is not null
  and (
    created_by = auth.uid()
    or assignee_id = auth.uid()
    or public.is_leader_or_manager(auth.uid())
  )
);

create policy tasks_update_related_or_manager
on public.tasks
for update
to authenticated
using (
  public.is_leader_or_manager(auth.uid())
  or created_by = auth.uid()
  or assignee_id = auth.uid()
)
with check (
  public.is_leader_or_manager(auth.uid())
  or created_by = auth.uid()
  or assignee_id = auth.uid()
);

create policy tasks_delete_related_or_manager
on public.tasks
for delete
to authenticated
using (
  public.is_leader_or_manager(auth.uid())
  or created_by = auth.uid()
  or assignee_id = auth.uid()
);

drop policy if exists kanban_columns_select_authenticated on public.kanban_columns;
drop policy if exists kanban_columns_write_manager on public.kanban_columns;

create policy kanban_columns_select_authenticated
on public.kanban_columns
for select
to authenticated
using (auth.uid() is not null);

create policy kanban_columns_write_manager
on public.kanban_columns
for all
to authenticated
using (public.is_leader_or_manager(auth.uid()))
with check (public.is_leader_or_manager(auth.uid()));

drop policy if exists "comments_select_auth" on public.comments;
drop policy if exists "comments_insert_own" on public.comments;
drop policy if exists "comments_modify_own" on public.comments;
drop policy if exists "comments_delete_own_or_admin" on public.comments;
drop policy if exists comments_select_authenticated on public.comments;
drop policy if exists comments_insert_own on public.comments;
drop policy if exists comments_update_own on public.comments;
drop policy if exists comments_delete_own_or_manager on public.comments;

create policy comments_select_authenticated
on public.comments
for select
to authenticated
using (auth.uid() is not null);

create policy comments_insert_own
on public.comments
for insert
to authenticated
with check (user_id = auth.uid());

create policy comments_update_own
on public.comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy comments_delete_own_or_manager
on public.comments
for delete
to authenticated
using (user_id = auth.uid() or public.is_leader_or_manager(auth.uid()));

drop policy if exists "te_select_auth" on public.time_entries;
drop policy if exists "te_insert_own" on public.time_entries;
drop policy if exists "te_update_own" on public.time_entries;
drop policy if exists "te_delete_own_or_admin" on public.time_entries;
drop policy if exists time_entries_select_authenticated on public.time_entries;
drop policy if exists time_entries_insert_own on public.time_entries;
drop policy if exists time_entries_update_own on public.time_entries;
drop policy if exists time_entries_delete_own_or_manager on public.time_entries;

create policy time_entries_select_authenticated
on public.time_entries
for select
to authenticated
using (auth.uid() is not null);

create policy time_entries_insert_own
on public.time_entries
for insert
to authenticated
with check (user_id = auth.uid());

create policy time_entries_update_own
on public.time_entries
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy time_entries_delete_own_or_manager
on public.time_entries
for delete
to authenticated
using (user_id = auth.uid() or public.is_leader_or_manager(auth.uid()));

-- Notificacoes individuais.
drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_delete_own on public.notifications;
drop policy if exists notifications_insert_authenticated on public.notifications;

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

create policy notifications_update_own
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy notifications_delete_own
on public.notifications
for delete
to authenticated
using (user_id = auth.uid());

create policy notifications_insert_authenticated
on public.notifications
for insert
to authenticated
with check (auth.uid() is not null);

-- Realtime para refletir arrastar/criar/editar/excluir em outras telas.
do $$
declare
  t text;
  tables text[] := array['tasks', 'kanban_columns', 'comments', 'time_entries', 'notifications'];
begin
  foreach t in array tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
