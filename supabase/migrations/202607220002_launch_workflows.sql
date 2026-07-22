alter table public.chore_occurrences add column period_key date;
alter table public.profiles add constraint profile_color_format_check check (color ~ '^#[0-9A-Fa-f]{6}$');

create unique index chore_occurrences_template_period_idx
  on public.chore_occurrences(template_id, period_key)
  where template_id is not null and period_key is not null;

create table public.savings_goals (
  crew_id uuid not null references public.crews(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  target_cents integer not null check (target_cents > 0 and target_cents <= 100000000),
  updated_at timestamptz not null default now(),
  primary key (crew_id, member_id)
);

create table public.managed_profile_credentials (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table public.managed_profile_pin_attempts (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index managed_profile_pin_attempts_lookup_idx
  on public.managed_profile_pin_attempts(profile_id, actor_id, attempted_at desc);

alter table public.savings_goals enable row level security;
alter table public.managed_profile_credentials enable row level security;
alter table public.managed_profile_pin_attempts enable row level security;

create policy savings_goals_read_members on public.savings_goals
for select to authenticated using (public.is_crew_member(crew_id));

revoke all on public.savings_goals, public.managed_profile_credentials, public.managed_profile_pin_attempts from anon, authenticated;
grant select on public.savings_goals to authenticated;

create or replace function public.assert_actor_can_use_profile(target_crew_id uuid, target_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_profile_id();
  is_managed boolean;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if not public.is_crew_member(target_crew_id, target_member_id) then raise exception 'Member is not in this crew'; end if;

  select exists (
    select 1 from public.profiles
    where id = target_member_id and managed_by = actor_id and auth_user_id is null
  ) into is_managed;

  if target_member_id <> actor_id and not is_managed then
    raise exception 'Not allowed to act for this member';
  end if;
end;
$$;

create function public.generate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));
    exit when not exists (select 1 from public.crews where invite_code = candidate);
  end loop;
  return candidate;
end;
$$;

create function public.create_crew(p_name text)
returns public.crews
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_profile_id();
  new_crew public.crews;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_name)) not between 1 and 80 then raise exception 'Crew name must be between 1 and 80 characters'; end if;

  insert into public.crews(name, invite_code, created_by)
  values (trim(p_name), public.generate_invite_code(), actor_id)
  returning * into new_crew;

  insert into public.crew_members(crew_id, profile_id, role)
  values (new_crew.id, actor_id, 'owner');

  return new_crew;
end;
$$;

create function public.join_crew_by_code(p_invite_code text)
returns public.crews
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_profile_id();
  target_crew public.crews;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;

  select * into target_crew
  from public.crews
  where invite_code = upper(trim(p_invite_code));

  if target_crew.id is null then raise exception 'Invite code not found'; end if;

  insert into public.crew_members(crew_id, profile_id, role)
  values (target_crew.id, actor_id, 'member')
  on conflict (crew_id, profile_id) do nothing;

  return target_crew;
end;
$$;

create function public.create_managed_profile(
  p_crew_id uuid,
  p_display_name text,
  p_pin text,
  p_color text default '#ef745e'
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_profile_id();
  child_profile public.profiles;
  cleaned_name text := trim(p_display_name);
begin
  if not public.can_manage_crew(p_crew_id, actor_id) then raise exception 'Manager role required'; end if;
  if char_length(cleaned_name) not between 1 and 60 then raise exception 'Name must be between 1 and 60 characters'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must contain exactly four numbers'; end if;
  if p_color is null or p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Choose a valid profile color'; end if;

  insert into public.profiles(managed_by, display_name, initials, color)
  values (actor_id, cleaned_name, upper(left(cleaned_name, 2)), p_color)
  returning * into child_profile;

  insert into public.managed_profile_credentials(profile_id, pin_hash)
  values (child_profile.id, crypt(p_pin, gen_salt('bf', 10)));

  insert into public.crew_members(crew_id, profile_id, role)
  values (p_crew_id, child_profile.id, 'member');

  return child_profile;
end;
$$;

create function public.verify_managed_profile_pin(p_profile_id uuid, p_pin text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  requesting_actor_id uuid := public.current_profile_id();
  recent_failures integer;
  verified boolean;
begin
  if requesting_actor_id is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(requesting_actor_id::text || ':' || p_profile_id::text, 0));

  delete from public.managed_profile_pin_attempts
  where attempted_at < now() - interval '15 minutes';

  select count(*) into recent_failures
  from public.managed_profile_pin_attempts
  where profile_id = p_profile_id and actor_id = requesting_actor_id;

  if recent_failures >= 5 then raise exception 'Too many PIN attempts. Try again in 15 minutes'; end if;

  select exists (
    select 1
    from public.profiles profile
    join public.managed_profile_credentials credentials on credentials.profile_id = profile.id
    where profile.id = p_profile_id
      and profile.managed_by = requesting_actor_id
      and credentials.pin_hash = crypt(p_pin, credentials.pin_hash)
  ) into verified;

  if verified then
    delete from public.managed_profile_pin_attempts
    where profile_id = p_profile_id and actor_id = requesting_actor_id;
  else
    insert into public.managed_profile_pin_attempts(profile_id, actor_id)
    values (p_profile_id, requesting_actor_id);
  end if;

  return verified;
end;
$$;

create function public.set_managed_profile_pin(p_profile_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must contain exactly four numbers'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and managed_by = public.current_profile_id() and auth_user_id is null
  ) then raise exception 'Managed profile not found'; end if;

  insert into public.managed_profile_credentials(profile_id, pin_hash, updated_at)
  values (p_profile_id, crypt(p_pin, gen_salt('bf', 10)), now())
  on conflict (profile_id) do update
  set pin_hash = excluded.pin_hash, updated_at = excluded.updated_at;

  delete from public.managed_profile_pin_attempts where profile_id = p_profile_id;
end;
$$;

create function public.update_crew_member_role(
  p_crew_id uuid,
  p_member_id uuid,
  p_role public.crew_role
)
returns public.crew_members
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_profile_id();
  current_role public.crew_role;
  owner_count integer;
  updated_membership public.crew_members;
begin
  if not exists (
    select 1 from public.crew_members
    where crew_id = p_crew_id and profile_id = actor_id and role = 'owner'
  ) then raise exception 'Owner role required'; end if;

  select role into current_role from public.crew_members
  where crew_id = p_crew_id and profile_id = p_member_id for update;
  if current_role is null then raise exception 'Crew member not found'; end if;

  if current_role = 'owner' and p_role <> 'owner' then
    select count(*) into owner_count from public.crew_members
    where crew_id = p_crew_id and role = 'owner';
    if owner_count <= 1 then raise exception 'A Crew must always have an owner'; end if;
  end if;

  update public.crew_members set role = p_role
  where crew_id = p_crew_id and profile_id = p_member_id
  returning * into updated_membership;
  return updated_membership;
end;
$$;

create function public.remove_crew_member(p_crew_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_profile_id();
  target_role public.crew_role;
  owner_count integer;
  managed_by_actor boolean;
begin
  if actor_id <> p_member_id and not exists (
    select 1 from public.crew_members
    where crew_id = p_crew_id and profile_id = actor_id and role = 'owner'
  ) then raise exception 'Owner role required'; end if;

  select role into target_role from public.crew_members
  where crew_id = p_crew_id and profile_id = p_member_id for update;
  if target_role is null then raise exception 'Crew member not found'; end if;

  if target_role = 'owner' then
    select count(*) into owner_count from public.crew_members
    where crew_id = p_crew_id and role = 'owner';
    if owner_count <= 1 then raise exception 'The last owner cannot leave the Crew'; end if;
  end if;

  select exists (
    select 1 from public.profiles where id = p_member_id and managed_by = actor_id and auth_user_id is null
  ) into managed_by_actor;

  delete from public.crew_members where crew_id = p_crew_id and profile_id = p_member_id;

  if managed_by_actor and not exists (select 1 from public.crew_members where profile_id = p_member_id) then
    delete from public.profiles where id = p_member_id;
  end if;
end;
$$;

create function public.create_chore(
  p_crew_id uuid,
  p_title text,
  p_category text,
  p_reward_cents integer,
  p_cadence text,
  p_instructions text default null,
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
  occurrence_period date;
begin
  if not public.can_manage_crew(p_crew_id, actor_id) then raise exception 'Manager role required'; end if;
  if char_length(trim(p_title)) not between 1 and 120 then raise exception 'Job title must be between 1 and 120 characters'; end if;
  if p_reward_cents <= 0 or p_reward_cents > 1000000 then raise exception 'Reward is outside the allowed range'; end if;
  if p_category not in ('kitchen', 'outside', 'pets', 'tidy', 'laundry', 'other') then raise exception 'Unsupported category'; end if;
  if normalized_cadence not in ('one_time', 'daily', 'weekdays', 'weekly') then raise exception 'Unsupported cadence'; end if;

  insert into public.chore_templates(
    crew_id, title, category, reward_cents, cadence, instructions, created_by
  ) values (
    p_crew_id, trim(p_title), p_category, p_reward_cents, normalized_cadence, nullif(trim(p_instructions), ''), actor_id
  ) returning * into template;

  occurrence_period := case
    when normalized_cadence = 'weekly' then date_trunc('week', current_date)::date
    else current_date
  end;

  insert into public.chore_occurrences(
    crew_id, template_id, title, category, reward_cents, instructions, due_at, period_key
  ) values (
    p_crew_id,
    template.id,
    template.title,
    template.category,
    template.reward_cents,
    template.instructions,
    coalesce(p_due_at, current_date + interval '23 hours 59 minutes'),
    occurrence_period
  ) returning * into occurrence;

  return occurrence;
end;
$$;

create function public.ensure_due_occurrences(p_crew_id uuid)
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

create function public.set_savings_goal(
  p_crew_id uuid,
  p_member_id uuid,
  p_name text,
  p_target_cents integer
)
returns public.savings_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  goal public.savings_goals;
begin
  perform public.assert_actor_can_use_profile(p_crew_id, p_member_id);
  if char_length(trim(p_name)) not between 1 and 80 then raise exception 'Goal name must be between 1 and 80 characters'; end if;
  if p_target_cents <= 0 then raise exception 'Goal amount must be positive'; end if;

  insert into public.savings_goals(crew_id, member_id, name, target_cents, updated_at)
  values (p_crew_id, p_member_id, trim(p_name), p_target_cents, now())
  on conflict (crew_id, member_id) do update
  set name = excluded.name, target_cents = excluded.target_cents, updated_at = excluded.updated_at
  returning * into goal;

  return goal;
end;
$$;

revoke all on function public.generate_invite_code() from public;
revoke all on function public.create_crew(text) from public;
revoke all on function public.join_crew_by_code(text) from public;
revoke all on function public.create_managed_profile(uuid, text, text, text) from public;
revoke all on function public.verify_managed_profile_pin(uuid, text) from public;
revoke all on function public.set_managed_profile_pin(uuid, text) from public;
revoke all on function public.update_crew_member_role(uuid, uuid, public.crew_role) from public;
revoke all on function public.remove_crew_member(uuid, uuid) from public;
revoke all on function public.create_chore(uuid, text, text, integer, text, text, timestamptz) from public;
revoke all on function public.ensure_due_occurrences(uuid) from public;
revoke all on function public.set_savings_goal(uuid, uuid, text, integer) from public;

grant execute on function public.create_crew(text) to authenticated;
grant execute on function public.join_crew_by_code(text) to authenticated;
grant execute on function public.create_managed_profile(uuid, text, text, text) to authenticated;
grant execute on function public.verify_managed_profile_pin(uuid, text) to authenticated;
grant execute on function public.set_managed_profile_pin(uuid, text) to authenticated;
grant execute on function public.update_crew_member_role(uuid, uuid, public.crew_role) to authenticated;
grant execute on function public.remove_crew_member(uuid, uuid) to authenticated;
grant execute on function public.create_chore(uuid, text, text, integer, text, text, timestamptz) to authenticated;
grant execute on function public.ensure_due_occurrences(uuid) to authenticated;
grant execute on function public.set_savings_goal(uuid, uuid, text, integer) to authenticated;

-- All value-bearing and membership mutations go through the checked RPCs above.
-- These revokes close direct-table paths left available by the foundation migration.
revoke insert on public.profiles from authenticated;
revoke insert on public.crews from authenticated;
revoke insert, update, delete on public.crew_members from authenticated;
revoke insert, update, delete on public.chore_templates from authenticated;
revoke insert on public.chore_occurrences from authenticated;

comment on function public.create_crew(text) is 'Creates a Crew and its owner membership atomically.';
comment on function public.join_crew_by_code(text) is 'Joins the authenticated profile to a Crew using its invite code.';
comment on table public.managed_profile_credentials is 'Server-only PIN credentials for parent-managed profiles.';
