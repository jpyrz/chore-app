-- Supabase installs pgcrypto in the extensions schema. These security-definer
-- functions intentionally restrict their search path, so crypto calls must be
-- schema-qualified.

create or replace function public.generate_invite_code()
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
    candidate := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10));
    exit when not exists (select 1 from public.crews where invite_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.create_managed_profile(
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
  values (child_profile.id, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)));

  insert into public.crew_members(crew_id, profile_id, role)
  values (p_crew_id, child_profile.id, 'member');

  return child_profile;
end;
$$;

create or replace function public.verify_managed_profile_pin(p_profile_id uuid, p_pin text)
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
      and credentials.pin_hash = extensions.crypt(p_pin, credentials.pin_hash)
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

create or replace function public.set_managed_profile_pin(p_profile_id uuid, p_pin text)
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
  values (p_profile_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), now())
  on conflict (profile_id) do update
  set pin_hash = excluded.pin_hash, updated_at = excluded.updated_at;

  delete from public.managed_profile_pin_attempts where profile_id = p_profile_id;
end;
$$;

-- Fail the migration immediately if pgcrypto cannot be resolved in the hosted
-- schema, before users encounter the problem at runtime.
do $$
declare
  test_code text;
  test_hash text;
begin
  test_code := public.generate_invite_code();
  if test_code !~ '^[A-Z0-9]{10}$' then
    raise exception 'Invite code generation self-check failed';
  end if;

  test_hash := extensions.crypt('1234', extensions.gen_salt('bf', 4));
  if test_hash is null or extensions.crypt('1234', test_hash) <> test_hash then
    raise exception 'Managed profile PIN hashing self-check failed';
  end if;
end;
$$;
