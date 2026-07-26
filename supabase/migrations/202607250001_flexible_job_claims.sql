alter table public.chore_templates
  add column assigned_member_id uuid references public.profiles(id) on delete set null,
  add column claim_window_hours integer default 24
    check (claim_window_hours is null or claim_window_hours between 1 and 8760);

alter table public.chore_occurrences
  add column claim_window_hours integer default 24
    check (claim_window_hours is null or claim_window_hours between 1 and 8760),
  add column is_assigned boolean not null default false;

-- Existing due dates were generated from the day a job was created, rather than
-- from an intentional deadline. Recurrence is represented by period_key, so
-- active jobs should not carry these misleading dates.
update public.chore_occurrences
set due_at = null
where status in ('available', 'claimed', 'review');

drop function if exists public.create_chore(uuid, text, text, integer, text, text, timestamptz);

create function public.create_chore(
  p_crew_id uuid,
  p_title text,
  p_category text,
  p_reward_cents integer,
  p_cadence text,
  p_instructions text default null,
  p_assigned_member_id uuid default null,
  p_claim_window_hours integer default 24,
  p_due_at timestamptz default null
)
returns public.chore_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_profile_id();
  template public.chore_templates;
  occurrence public.chore_occurrences;
  normalized_cadence text := lower(trim(p_cadence));
  normalized_claim_window integer;
  occurrence_period date;
begin
  if not public.can_manage_crew(p_crew_id, actor_id) then raise exception 'Manager role required'; end if;
  if char_length(trim(p_title)) not between 1 and 120 then raise exception 'Job title must be between 1 and 120 characters'; end if;
  if p_reward_cents <= 0 or p_reward_cents > 1000000 then raise exception 'Reward is outside the allowed range'; end if;
  if p_category not in ('kitchen', 'outside', 'pets', 'tidy', 'laundry', 'other') then raise exception 'Unsupported category'; end if;
  if normalized_cadence not in ('one_time', 'daily', 'weekdays', 'weekly') then raise exception 'Unsupported cadence'; end if;
  if p_claim_window_hours is not null and p_claim_window_hours not between 1 and 8760 then
    raise exception 'Claim window must be between 1 hour and 1 year';
  end if;
  if p_assigned_member_id is not null and not public.is_crew_member(p_crew_id, p_assigned_member_id) then
    raise exception 'Assigned profile must belong to this Crew';
  end if;

  normalized_claim_window := case
    when p_assigned_member_id is not null then null
    else p_claim_window_hours
  end;

  insert into public.chore_templates(
    crew_id,
    title,
    category,
    reward_cents,
    cadence,
    instructions,
    assigned_member_id,
    claim_window_hours,
    created_by
  ) values (
    p_crew_id,
    trim(p_title),
    p_category,
    p_reward_cents,
    normalized_cadence,
    nullif(trim(p_instructions), ''),
    p_assigned_member_id,
    normalized_claim_window,
    actor_id
  ) returning * into template;

  occurrence_period := case
    when normalized_cadence = 'weekly' then date_trunc('week', current_date)::date
    else current_date
  end;

  insert into public.chore_occurrences(
    crew_id,
    template_id,
    title,
    category,
    reward_cents,
    instructions,
    due_at,
    period_key,
    status,
    assignee_id,
    claimed_at,
    claim_window_hours,
    is_assigned
  ) values (
    p_crew_id,
    template.id,
    template.title,
    template.category,
    template.reward_cents,
    template.instructions,
    p_due_at,
    occurrence_period,
    case when p_assigned_member_id is null then 'available'::public.chore_status else 'claimed'::public.chore_status end,
    p_assigned_member_id,
    case when p_assigned_member_id is null then null else now() end,
    normalized_claim_window,
    p_assigned_member_id is not null
  ) returning * into occurrence;

  return occurrence;
end;
$$;

revoke all on function public.create_chore(uuid, text, text, integer, text, text, uuid, integer, timestamptz) from public;
grant execute on function public.create_chore(uuid, text, text, integer, text, text, uuid, integer, timestamptz) to authenticated;

create or replace function public.release_expired_claims(p_crew_id uuid)
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
    and not is_assigned
    and claim_window_hours is not null
    and claimed_at <= now() - make_interval(hours => claim_window_hours);

  get diagnostics released_count = row_count;
  return released_count;
end;
$$;

create or replace function public.ensure_due_occurrences(p_crew_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  template public.chore_templates;
  occurrence_period date;
  effective_assignee uuid;
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

    effective_assignee := case
      when template.assigned_member_id is not null
        and public.is_crew_member(template.crew_id, template.assigned_member_id)
      then template.assigned_member_id
      else null
    end;

    insert into public.chore_occurrences(
      crew_id,
      template_id,
      title,
      category,
      reward_cents,
      instructions,
      due_at,
      period_key,
      status,
      assignee_id,
      claimed_at,
      claim_window_hours,
      is_assigned
    ) values (
      template.crew_id,
      template.id,
      template.title,
      template.category,
      template.reward_cents,
      template.instructions,
      null,
      occurrence_period,
      case when effective_assignee is null then 'available'::public.chore_status else 'claimed'::public.chore_status end,
      effective_assignee,
      case when effective_assignee is null then null else now() end,
      case when effective_assignee is null then template.claim_window_hours else null end,
      effective_assignee is not null
    ) on conflict (template_id, period_key) where template_id is not null and period_key is not null do nothing;

    get diagnostics did_insert = row_count;
    inserted_count := inserted_count + did_insert;
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.unclaim_chore(p_occurrence_id uuid, p_member_id uuid default null)
returns public.chore_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  target_member_id uuid := coalesce(p_member_id, public.current_profile_id());
  occurrence public.chore_occurrences;
begin
  select * into occurrence
  from public.chore_occurrences
  where id = p_occurrence_id
  for update;

  if occurrence.id is null then raise exception 'Job not found'; end if;
  perform public.assert_actor_can_use_profile(occurrence.crew_id, target_member_id);

  if occurrence.is_assigned then
    raise exception 'Assigned jobs cannot be unclaimed';
  end if;
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

create or replace function public.notify_new_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_assigned and new.assignee_id is not null then
    insert into public.notifications(
      crew_id, recipient_id, kind, title, body, occurrence_id, dedupe_key
    ) values (
      new.crew_id,
      new.assignee_id,
      'new_job',
      'A job was assigned to you',
      new.title || ' is now in your lineup for $' || to_char(new.reward_cents / 100.0, 'FM999999990.00') || '.',
      new.id,
      'new_job:' || new.id::text
    )
    on conflict (recipient_id, dedupe_key) do nothing;
  elsif new.status = 'available' then
    insert into public.notifications(
      crew_id, recipient_id, kind, title, body, occurrence_id, dedupe_key
    )
    select
      new.crew_id,
      members.profile_id,
      'new_job',
      'New job: ' || new.title,
      '$' || to_char(new.reward_cents / 100.0, 'FM999999990.00') || ' is up for grabs.',
      new.id,
      'new_job:' || new.id::text
    from public.crew_members members
    where members.crew_id = new.crew_id
      and members.role = 'member'
    on conflict (recipient_id, dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists chore_occurrence_notify_new_job on public.chore_occurrences;
create trigger chore_occurrence_notify_new_job
  after insert on public.chore_occurrences
  for each row execute function public.notify_new_job();

comment on function public.release_expired_claims(uuid) is
  'Returns unsubmitted, non-assigned jobs to the available pool after each occurrence-specific claim window. Null windows do not expire.';

comment on column public.chore_templates.claim_window_hours is
  'Hours allowed after claiming. Null means the claim does not expire.';

comment on column public.chore_occurrences.is_assigned is
  'True when a manager placed the occurrence directly into one member''s lineup.';
