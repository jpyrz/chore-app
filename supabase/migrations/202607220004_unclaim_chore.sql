create function public.unclaim_chore(p_occurrence_id uuid, p_member_id uuid default null)
returns public.chore_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  occurrence public.chore_occurrences;
  target_member_id uuid := coalesce(p_member_id, public.current_profile_id());
begin
  select * into occurrence
  from public.chore_occurrences
  where id = p_occurrence_id
  for update;

  if occurrence.id is null then raise exception 'Job not found'; end if;
  perform public.assert_actor_can_use_profile(occurrence.crew_id, target_member_id);

  if occurrence.status <> 'claimed' or occurrence.assignee_id <> target_member_id then
    raise exception 'Only the assigned member can unclaim this job';
  end if;

  update public.chore_occurrences
  set
    status = 'available',
    assignee_id = null,
    claimed_at = null,
    completed_at = null,
    approved_at = null,
    approved_by = null
  where id = p_occurrence_id
  returning * into occurrence;

  return occurrence;
end;
$$;

revoke all on function public.unclaim_chore(uuid, uuid) from public;
grant execute on function public.unclaim_chore(uuid, uuid) to authenticated;

comment on function public.unclaim_chore(uuid, uuid) is
  'Atomically returns a claimed job to the available pool for its assigned member.';
