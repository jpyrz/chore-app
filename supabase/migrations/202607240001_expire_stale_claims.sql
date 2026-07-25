create function public.release_expired_claims(p_crew_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released_count integer;
begin
  if not public.is_crew_member(p_crew_id) then raise exception 'Crew membership required'; end if;

  update public.chore_occurrences
  set
    status = 'available',
    assignee_id = null,
    claimed_at = null,
    completed_at = null,
    approved_at = null,
    approved_by = null
  where crew_id = p_crew_id
    and status = 'claimed'
    and claimed_at <= now() - interval '24 hours';

  get diagnostics released_count = row_count;
  return released_count;
end;
$$;

revoke all on function public.release_expired_claims(uuid) from public;

create or replace function public.ensure_due_occurrences(p_crew_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  template public.chore_templates;
  occurrence_period date;
  inserted_count integer := 0;
  did_insert integer;
begin
  if not public.is_crew_member(p_crew_id) then raise exception 'Crew membership required'; end if;

  perform public.release_expired_claims(p_crew_id);

  for template in
    select * from public.chore_templates
    where crew_id = p_crew_id and is_active = true and cadence <> 'one_time'
  loop
    if template.cadence = 'weekdays' and extract(isodow from current_date) > 5 then
      continue;
    end if;

    occurrence_period := case
      when template.cadence = 'weekly' then date_trunc('week', current_date)::date
      else current_date
    end;

    insert into public.chore_occurrences(
      crew_id, template_id, title, category, reward_cents, instructions, due_at, period_key
    ) values (
      template.crew_id,
      template.id,
      template.title,
      template.category,
      template.reward_cents,
      template.instructions,
      current_date + interval '23 hours 59 minutes',
      occurrence_period
    ) on conflict (template_id, period_key) where template_id is not null and period_key is not null do nothing;

    get diagnostics did_insert = row_count;
    inserted_count := inserted_count + did_insert;
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.resolve_chore_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'claimed' and old.status = 'available' then
    update public.notifications
    set read_at = coalesce(read_at, now())
    where occurrence_id = new.id
      and kind = 'new_job'
      and read_at is null;
  elsif new.status = 'available' and old.status = 'claimed' then
    insert into public.notifications(
      crew_id, recipient_id, kind, title, body, occurrence_id, dedupe_key
    )
    select
      new.crew_id,
      members.profile_id,
      'new_job',
      'Available again: ' || new.title,
      '$' || to_char(new.reward_cents / 100.0, 'FM999999990.00') || ' is back up for grabs.',
      new.id,
      'released_job:' || new.id::text || ':' || coalesce(old.claimed_at::text, now()::text)
    from public.crew_members members
    where members.crew_id = new.crew_id
      and members.role = 'member'
    on conflict (recipient_id, dedupe_key) do nothing;
  elsif new.status in ('completed', 'cancelled') then
    update public.notifications
    set read_at = coalesce(read_at, now())
    where occurrence_id = new.id
      and kind = 'approval_needed'
      and read_at is null;
  end if;

  return new;
end;
$$;

comment on function public.release_expired_claims(uuid) is
  'Returns still-claimed jobs to the available pool 24 hours after they were claimed. Submitted jobs are not affected.';
