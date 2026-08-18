-- Encerra uma recorrencia e remove a ocorrencia atual e todas as futuras.
-- Ocorrencias anteriores permanecem no historico.

create or replace function public.stop_task_recurrence(
  _template_id uuid,
  _from_date timestamptz
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
  deleted_ids uuid[];
begin
  if auth.uid() is null or _from_date is null then
    raise exception 'Usuario ou data da ocorrencia invalida'
      using errcode = '22023';
  end if;

  select (
    public.is_leader_or_manager(auth.uid())
    or template.created_by = auth.uid()
    or template.assignee_id = auth.uid()
    or exists (
      select 1
      from public.team_members manager_membership
      inner join public.team_members member_membership
        on member_membership.team_id = manager_membership.team_id
      where manager_membership.user_id = auth.uid()
        and manager_membership.role_in_team::text = 'manager'
        and member_membership.user_id = template.assignee_id
    )
  )
  into allowed
  from public.tasks template
  where template.id = _template_id
    and template.is_template = true;

  if not coalesce(allowed, false) then
    raise exception 'Sem permissao para encerrar esta recorrencia'
      using errcode = '42501';
  end if;

  update public.tasks
  set recurrence = jsonb_set(
        coalesce(recurrence, '{}'::jsonb),
        '{mode}',
        '"none"'::jsonb,
        true
      ),
      last_spawn = now(),
      updated_at = now()
  where id = _template_id;

  with deleted as (
    delete from public.tasks
    where template_id = _template_id
      and due_date >= _from_date
    returning id
  )
  select coalesce(array_agg(id), array[]::uuid[])
  into deleted_ids
  from deleted;

  return deleted_ids;
end;
$$;

revoke execute on function public.stop_task_recurrence(uuid, timestamptz)
from public, anon;

grant execute on function public.stop_task_recurrence(uuid, timestamptz)
to authenticated;
