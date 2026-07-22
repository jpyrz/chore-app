create extension if not exists pgcrypto;

create type public.crew_role as enum ('owner', 'manager', 'member');
create type public.chore_status as enum ('available', 'claimed', 'review', 'completed', 'cancelled');
create type public.ledger_kind as enum ('earning', 'payout', 'adjustment');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  managed_by uuid references public.profiles(id) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 60),
  initials text not null check (char_length(initials) between 1 and 3),
  color text not null default '#247c66',
  created_at timestamptz not null default now(),
  constraint profile_identity_check check (
    (auth_user_id is not null and managed_by is null)
    or (auth_user_id is null and managed_by is not null)
  )
);

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6,10}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.crew_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (crew_id, profile_id)
);

create table public.chore_templates (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category text not null default 'other',
  reward_cents integer not null check (reward_cents > 0 and reward_cents <= 1000000),
  cadence text not null default 'one_time',
  schedule_config jsonb not null default '{}'::jsonb,
  instructions text check (instructions is null or char_length(instructions) <= 1000),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.chore_occurrences (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  template_id uuid references public.chore_templates(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  category text not null default 'other',
  reward_cents integer not null check (reward_cents > 0 and reward_cents <= 1000000),
  instructions text,
  due_at timestamptz,
  status public.chore_status not null default 'available',
  assignee_id uuid references public.profiles(id) on delete restrict,
  claimed_at timestamptz,
  completed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint occurrence_state_check check (
    (status = 'available' and assignee_id is null and claimed_at is null)
    or (status = 'claimed' and assignee_id is not null and claimed_at is not null)
    or (status = 'review' and assignee_id is not null and completed_at is not null)
    or (status = 'completed' and assignee_id is not null and approved_at is not null and approved_by is not null)
    or status = 'cancelled'
  )
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete restrict,
  member_id uuid not null references public.profiles(id) on delete restrict,
  kind public.ledger_kind not null,
  amount_cents integer not null check (amount_cents <> 0),
  description text not null check (char_length(description) between 1 and 160),
  occurrence_id uuid references public.chore_occurrences(id) on delete restrict,
  idempotency_key text not null unique,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint ledger_sign_check check (
    (kind = 'earning' and amount_cents > 0 and occurrence_id is not null)
    or (kind = 'payout' and amount_cents < 0 and occurrence_id is null)
    or kind = 'adjustment'
  )
);

create unique index ledger_one_earning_per_occurrence
  on public.ledger_entries (occurrence_id)
  where kind = 'earning';
create index crew_members_profile_idx on public.crew_members(profile_id);
create index chore_occurrences_crew_status_idx on public.chore_occurrences(crew_id, status);
create index ledger_entries_member_created_idx on public.ledger_entries(member_id, created_at desc);

create function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1
$$;

create function public.is_crew_member(target_crew_id uuid, target_profile_id uuid default public.current_profile_id())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crew_members
    where crew_id = target_crew_id and profile_id = target_profile_id
  )
$$;

create function public.can_manage_crew(target_crew_id uuid, target_profile_id uuid default public.current_profile_id())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crew_members
    where crew_id = target_crew_id
      and profile_id = target_profile_id
      and role in ('owner', 'manager')
  )
$$;

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'New member');
  insert into public.profiles (auth_user_id, display_name, initials)
  values (new.id, profile_name, upper(left(profile_name, 2)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.chore_templates enable row level security;
alter table public.chore_occurrences enable row level security;
alter table public.ledger_entries enable row level security;

create policy profiles_read_shared_crews on public.profiles
for select to authenticated
using (
  id = public.current_profile_id()
  or managed_by = public.current_profile_id()
  or exists (
    select 1
    from public.crew_members mine
    join public.crew_members theirs on theirs.crew_id = mine.crew_id
    where mine.profile_id = public.current_profile_id()
      and theirs.profile_id = profiles.id
  )
);

create policy profiles_update_self_or_managed on public.profiles
for update to authenticated
using (id = public.current_profile_id() or managed_by = public.current_profile_id())
with check (id = public.current_profile_id() or managed_by = public.current_profile_id());

create policy profiles_create_managed on public.profiles
for insert to authenticated
with check (auth_user_id is null and managed_by = public.current_profile_id());

create policy crews_read_members on public.crews
for select to authenticated using (public.is_crew_member(id));

create policy crews_create on public.crews
for insert to authenticated with check (created_by = public.current_profile_id());

create policy crews_update_owners on public.crews
for update to authenticated using (
  exists (
    select 1 from public.crew_members
    where crew_id = crews.id and profile_id = public.current_profile_id() and role = 'owner'
  )
);

create policy crew_members_read_members on public.crew_members
for select to authenticated using (public.is_crew_member(crew_id));

create policy crew_members_add_by_manager_or_creator on public.crew_members
for insert to authenticated with check (
  public.can_manage_crew(crew_id)
  or exists (
    select 1 from public.crews
    where id = crew_members.crew_id and created_by = public.current_profile_id()
  )
);

create policy crew_members_update_managers on public.crew_members
for update to authenticated using (public.can_manage_crew(crew_id));

create policy crew_members_delete_managers on public.crew_members
for delete to authenticated using (public.can_manage_crew(crew_id));

create policy chore_templates_read_members on public.chore_templates
for select to authenticated using (public.is_crew_member(crew_id));

create policy chore_templates_create_managers on public.chore_templates
for insert to authenticated
with check (public.can_manage_crew(crew_id) and created_by = public.current_profile_id());

create policy chore_templates_update_managers on public.chore_templates
for update to authenticated
using (public.can_manage_crew(crew_id))
with check (public.can_manage_crew(crew_id));

create policy chore_templates_delete_managers on public.chore_templates
for delete to authenticated using (public.can_manage_crew(crew_id));

create policy chore_occurrences_read_members on public.chore_occurrences
for select to authenticated using (public.is_crew_member(crew_id));

create policy chore_occurrences_create_managers on public.chore_occurrences
for insert to authenticated with check (public.can_manage_crew(crew_id));

create policy ledger_read_members on public.ledger_entries
for select to authenticated using (public.is_crew_member(crew_id));

create function public.assert_actor_can_use_profile(target_crew_id uuid, target_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_profile_id();
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if not public.is_crew_member(target_crew_id, target_member_id) then raise exception 'Member is not in this crew'; end if;
  if target_member_id <> actor_id and not public.can_manage_crew(target_crew_id, actor_id) then
    raise exception 'Not allowed to act for this member';
  end if;
end;
$$;

create function public.claim_chore(p_occurrence_id uuid, p_member_id uuid default null)
returns public.chore_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  occurrence public.chore_occurrences;
  target_member_id uuid := coalesce(p_member_id, public.current_profile_id());
begin
  select * into occurrence from public.chore_occurrences where id = p_occurrence_id for update;
  if occurrence.id is null then raise exception 'Job not found'; end if;
  perform public.assert_actor_can_use_profile(occurrence.crew_id, target_member_id);
  if occurrence.status <> 'available' then raise exception 'Job is no longer available'; end if;

  update public.chore_occurrences
    set status = 'claimed', assignee_id = target_member_id, claimed_at = now()
    where id = p_occurrence_id
    returning * into occurrence;
  return occurrence;
end;
$$;

create function public.complete_chore(p_occurrence_id uuid, p_member_id uuid default null)
returns public.chore_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  occurrence public.chore_occurrences;
  target_member_id uuid := coalesce(p_member_id, public.current_profile_id());
begin
  select * into occurrence from public.chore_occurrences where id = p_occurrence_id for update;
  if occurrence.id is null then raise exception 'Job not found'; end if;
  perform public.assert_actor_can_use_profile(occurrence.crew_id, target_member_id);
  if occurrence.status <> 'claimed' or occurrence.assignee_id <> target_member_id then
    raise exception 'Only the assigned member can finish this job';
  end if;

  update public.chore_occurrences
    set status = 'review', completed_at = now()
    where id = p_occurrence_id
    returning * into occurrence;
  return occurrence;
end;
$$;

create function public.approve_chore(p_occurrence_id uuid, p_idempotency_key text)
returns public.chore_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  occurrence public.chore_occurrences;
  actor_id uuid := public.current_profile_id();
begin
  select * into occurrence from public.chore_occurrences where id = p_occurrence_id for update;
  if occurrence.id is null then raise exception 'Job not found'; end if;
  if not public.can_manage_crew(occurrence.crew_id, actor_id) then raise exception 'Manager role required'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Idempotency key required'; end if;

  if occurrence.status = 'completed' then return occurrence; end if;
  if occurrence.status <> 'review' then raise exception 'Job is not ready for review'; end if;

  update public.chore_occurrences
    set status = 'completed', approved_at = now(), approved_by = actor_id
    where id = p_occurrence_id
    returning * into occurrence;

  insert into public.ledger_entries (
    crew_id, member_id, kind, amount_cents, description, occurrence_id, idempotency_key, created_by
  ) values (
    occurrence.crew_id,
    occurrence.assignee_id,
    'earning',
    occurrence.reward_cents,
    occurrence.title,
    occurrence.id,
    'approval:' || occurrence.id::text || ':' || p_idempotency_key,
    actor_id
  ) on conflict (idempotency_key) do nothing;

  return occurrence;
end;
$$;

create function public.record_payout(
  p_crew_id uuid,
  p_member_id uuid,
  p_amount_cents integer,
  p_description text,
  p_idempotency_key text
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_profile_id();
  entry public.ledger_entries;
  available_balance integer;
  effective_key text := 'payout:' || p_crew_id::text || ':' || p_member_id::text || ':' || p_idempotency_key;
begin
  if not public.can_manage_crew(p_crew_id, actor_id) then raise exception 'Manager role required'; end if;
  if not public.is_crew_member(p_crew_id, p_member_id) then raise exception 'Member is not in this crew'; end if;
  if p_amount_cents <= 0 then raise exception 'Payout must be positive'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Idempotency key required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_crew_id::text || ':' || p_member_id::text, 0));

  select * into entry from public.ledger_entries where idempotency_key = effective_key;
  if entry.id is not null then return entry; end if;

  select coalesce(sum(amount_cents), 0) into available_balance
  from public.ledger_entries
  where crew_id = p_crew_id and member_id = p_member_id;

  if p_amount_cents > available_balance then raise exception 'Payout exceeds available balance'; end if;

  insert into public.ledger_entries (
    crew_id, member_id, kind, amount_cents, description, idempotency_key, created_by
  ) values (
    p_crew_id, p_member_id, 'payout', -p_amount_cents, p_description, effective_key, actor_id
  )
  on conflict (idempotency_key) do nothing
  returning * into entry;

  if entry.id is null then
    select * into entry from public.ledger_entries where idempotency_key = effective_key;
  end if;
  return entry;
end;
$$;

create function public.prevent_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Ledger entries are append-only';
end;
$$;

create trigger ledger_entries_append_only
  before update or delete on public.ledger_entries
  for each row execute function public.prevent_ledger_mutation();

revoke all on public.profiles, public.crews, public.crew_members, public.chore_templates, public.chore_occurrences, public.ledger_entries from anon, authenticated;

grant select, insert on public.profiles to authenticated;
grant update (display_name, initials, color) on public.profiles to authenticated;
grant select, insert on public.crews to authenticated;
grant update (name, invite_code) on public.crews to authenticated;
grant select, insert, delete on public.crew_members to authenticated;
grant update (role) on public.crew_members to authenticated;
grant select, insert, delete on public.chore_templates to authenticated;
grant update (title, category, reward_cents, cadence, schedule_config, instructions, is_active) on public.chore_templates to authenticated;
grant select, insert on public.chore_occurrences to authenticated;
grant select on public.ledger_entries to authenticated;

revoke all on function public.claim_chore(uuid, uuid) from public;
revoke all on function public.complete_chore(uuid, uuid) from public;
revoke all on function public.approve_chore(uuid, text) from public;
revoke all on function public.record_payout(uuid, uuid, integer, text, text) from public;
grant execute on function public.claim_chore(uuid, uuid) to authenticated;
grant execute on function public.complete_chore(uuid, uuid) to authenticated;
grant execute on function public.approve_chore(uuid, text) to authenticated;
grant execute on function public.record_payout(uuid, uuid, integer, text, text) to authenticated;

comment on table public.ledger_entries is 'Append-only record of value-bearing events. Never update or delete entries.';
comment on function public.approve_chore(uuid, text) is 'Atomically approves one occurrence and records at most one earning.';
