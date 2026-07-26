create function public.archive_chore(p_template_id uuid)
returns public.chore_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_profile_id();
  job public.chore_templates;
begin
  select * into job
  from public.chore_templates
  where id = p_template_id
  for update;

  if job.id is null then raise exception 'Job not found'; end if;
  if not public.can_manage_crew(job.crew_id, actor_id) then raise exception 'Manager role required'; end if;

  if job.is_active then
    update public.chore_templates
    set is_active = false
    where id = job.id
    returning * into job;

    -- Available and in-progress copies leave the active board. Work that has
    -- already been submitted stays in review so it can still be approved.
    update public.chore_occurrences
    set status = 'cancelled'
    where template_id = job.id
      and status in ('available', 'claimed');

    update public.notifications
    set read_at = coalesce(read_at, now())
    where occurrence_id in (
      select id
      from public.chore_occurrences
      where template_id = job.id
        and status = 'cancelled'
    )
      and read_at is null;
  end if;

  return job;
end;
$$;

revoke all on function public.archive_chore(uuid) from public;
grant execute on function public.archive_chore(uuid) to authenticated;

comment on function public.archive_chore(uuid) is
  'Manager-only retirement of a job template. Cancels open copies, preserves submitted and completed work, and stops future recurrence.';
