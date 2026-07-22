create type public.notification_kind as enum ('approval_needed', 'new_job', 'payout_recorded');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 400),
  occurrence_id uuid references public.chore_occurrences(id) on delete set null,
  ledger_entry_id uuid references public.ledger_entries(id) on delete set null,
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_id, dedupe_key)
);

create index notifications_recipient_created_idx
  on public.notifications(crew_id, recipient_id, created_at desc);

create index notifications_unread_idx
  on public.notifications(crew_id, recipient_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_read_own_profile on public.notifications
for select to authenticated
using (
  public.is_crew_member(crew_id)
  and (
    recipient_id = public.current_profile_id()
    or exists (
      select 1
      from public.profiles
      where id = notifications.recipient_id
        and managed_by = public.current_profile_id()
        and auth_user_id is null
    )
  )
);

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

create function public.mark_notification_read(p_notification_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_notification public.notifications;
begin
  select * into target_notification
  from public.notifications
  where id = p_notification_id;

  if target_notification.id is null then raise exception 'Notification not found'; end if;
  if target_notification.recipient_id <> p_member_id then raise exception 'Notification does not belong to this profile'; end if;
  if not public.is_crew_member(target_notification.crew_id) then raise exception 'Crew membership required'; end if;
  perform public.assert_actor_can_use_profile(target_notification.crew_id, p_member_id);

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id;
end;
$$;

create function public.mark_all_notifications_read(p_crew_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_crew_member(p_crew_id) then raise exception 'Crew membership required'; end if;
  perform public.assert_actor_can_use_profile(p_crew_id, p_member_id);

  update public.notifications
  set read_at = now()
  where crew_id = p_crew_id
    and recipient_id = p_member_id
    and read_at is null;
end;
$$;

create function public.notify_new_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

  return new;
end;
$$;

create trigger chore_occurrence_notify_new_job
  after insert on public.chore_occurrences
  for each row
  when (new.status = 'available')
  execute function public.notify_new_job();

create function public.notify_approval_needed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_name text;
begin
  select display_name into member_name
  from public.profiles
  where id = new.assignee_id;

  insert into public.notifications(
    crew_id, recipient_id, kind, title, body, occurrence_id, dedupe_key
  )
  select
    new.crew_id,
    members.profile_id,
    'approval_needed',
    new.title || ' is ready for approval',
    coalesce(member_name, 'A Crew member') || ' marked this job finished.',
    new.id,
    'approval_needed:' || new.id::text
  from public.crew_members members
  where members.crew_id = new.crew_id
    and members.role in ('owner', 'manager')
  on conflict (recipient_id, dedupe_key) do nothing;

  return new;
end;
$$;

create trigger chore_occurrence_notify_approval
  after update of status on public.chore_occurrences
  for each row
  when (new.status = 'review' and old.status is distinct from new.status)
  execute function public.notify_approval_needed();

create function public.resolve_chore_notifications()
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

create trigger chore_occurrence_resolve_notifications
  after update of status on public.chore_occurrences
  for each row
  when (old.status is distinct from new.status)
  execute function public.resolve_chore_notifications();

create function public.notify_payout_recorded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind <> 'payout' then return new; end if;

  insert into public.notifications(
    crew_id, recipient_id, kind, title, body, ledger_entry_id, dedupe_key
  ) values (
    new.crew_id,
    new.member_id,
    'payout_recorded',
    'Payout recorded',
    '$' || to_char(abs(new.amount_cents) / 100.0, 'FM999999990.00') || ' was marked as paid.',
    new.id,
    'payout_recorded:' || new.id::text
  )
  on conflict (recipient_id, dedupe_key) do nothing;

  return new;
end;
$$;

create trigger ledger_entry_notify_payout
  after insert on public.ledger_entries
  for each row execute function public.notify_payout_recorded();

revoke all on function public.mark_notification_read(uuid, uuid) from public;
revoke all on function public.mark_all_notifications_read(uuid, uuid) from public;
revoke all on function public.notify_new_job() from public;
revoke all on function public.notify_approval_needed() from public;
revoke all on function public.resolve_chore_notifications() from public;
revoke all on function public.notify_payout_recorded() from public;

grant execute on function public.mark_notification_read(uuid, uuid) to authenticated;
grant execute on function public.mark_all_notifications_read(uuid, uuid) to authenticated;

do $$
declare
  relation_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach relation_name in array array[
      'crews',
      'crew_members',
      'chore_templates',
      'chore_occurrences',
      'ledger_entries',
      'savings_goals',
      'notifications'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = relation_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', relation_name);
      end if;
    end loop;
  end if;
end;
$$;

comment on table public.notifications is
  'Persistent, profile-scoped activity notices generated by trusted database events.';
