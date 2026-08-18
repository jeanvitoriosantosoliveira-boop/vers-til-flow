-- Garante persistencia de movimentacao e exclusao das tarefas do Kanban.
-- Lideres e gerentes podem gerenciar todas as tarefas. Colaboradores podem
-- gerenciar tarefas criadas ou atribuidas a eles. Gerentes de time tambem
-- podem gerenciar tarefas atribuidas aos integrantes dos seus times.

create or replace function public.is_team_manager_of(_manager_id uuid, _member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members manager_membership
    inner join public.team_members member_membership
      on member_membership.team_id = manager_membership.team_id
    where manager_membership.user_id = _manager_id
      and manager_membership.role_in_team::text = 'manager'
      and member_membership.user_id = _member_id
  );
$$;

revoke execute on function public.is_team_manager_of(uuid, uuid) from public, anon;
grant execute on function public.is_team_manager_of(uuid, uuid) to authenticated;

create index if not exists team_members_user_team_idx
  on public.team_members (user_id, team_id);

create index if not exists team_members_team_user_idx
  on public.team_members (team_id, user_id);

alter table public.tasks enable row level security;

grant select, insert, update, delete on public.tasks to authenticated;

drop policy if exists "tasks_update_auth" on public.tasks;
drop policy if exists tasks_update_authenticated on public.tasks;
drop policy if exists tasks_update_related_or_manager on public.tasks;
drop policy if exists tasks_update_team_manager on public.tasks;

create policy tasks_update_related_or_manager
on public.tasks
for update
to authenticated
using (
  public.is_leader_or_manager(auth.uid())
  or created_by = auth.uid()
  or assignee_id = auth.uid()
  or public.is_team_manager_of(auth.uid(), assignee_id)
)
with check (
  public.is_leader_or_manager(auth.uid())
  or created_by = auth.uid()
  or assignee_id = auth.uid()
  or public.is_team_manager_of(auth.uid(), assignee_id)
);

drop policy if exists "tasks_delete_admin" on public.tasks;
drop policy if exists tasks_delete_authenticated on public.tasks;
drop policy if exists tasks_delete_related_or_manager on public.tasks;
drop policy if exists tasks_delete_team_manager on public.tasks;

create policy tasks_delete_related_or_manager
on public.tasks
for delete
to authenticated
using (
  public.is_leader_or_manager(auth.uid())
  or created_by = auth.uid()
  or assignee_id = auth.uid()
  or public.is_team_manager_of(auth.uid(), assignee_id)
);
