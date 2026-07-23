alter table public.ledger_entries
  add column category text;

alter table public.ledger_entries
  disable trigger ledger_entries_append_only;

update public.ledger_entries
set category = case
  when kind = 'earning' then 'chore'
  when kind = 'payout' then 'withdrawal'
  else 'correction'
end;

alter table public.ledger_entries
  enable trigger ledger_entries_append_only;

alter table public.ledger_entries
  alter column category set default 'correction',
  alter column category set not null,
  add constraint ledger_category_check check (
    category in ('chore', 'gift', 'allowance', 'deposit', 'purchase', 'withdrawal', 'correction')
  );

create or replace view public.bank_balances
with (security_invoker = true)
as
select
  crew_id,
  member_id,
  coalesce(sum(amount_cents), 0)::integer as balance_cents
from public.ledger_entries
group by crew_id, member_id;

revoke all on public.bank_balances from anon, authenticated;
grant select on public.bank_balances to authenticated;

create or replace function public.approve_chore(p_occurrence_id uuid, p_idempotency_key text)
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
    crew_id, member_id, kind, category, amount_cents, description, occurrence_id, idempotency_key, created_by
  ) values (
    occurrence.crew_id,
    occurrence.assignee_id,
    'earning',
    'chore',
    occurrence.reward_cents,
    occurrence.title,
    occurrence.id,
    'approval:' || occurrence.id::text || ':' || p_idempotency_key,
    actor_id
  ) on conflict (idempotency_key) do nothing;

  return occurrence;
end;
$$;

create or replace function public.record_payout(
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
  if nullif(trim(p_description), '') is null then raise exception 'Description required'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Idempotency key required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_crew_id::text || ':' || p_member_id::text, 0));

  select * into entry from public.ledger_entries where idempotency_key = effective_key;
  if entry.id is not null then return entry; end if;

  select coalesce(sum(amount_cents), 0) into available_balance
  from public.ledger_entries
  where crew_id = p_crew_id and member_id = p_member_id;

  if p_amount_cents > available_balance then raise exception 'Payout exceeds available balance'; end if;

  insert into public.ledger_entries (
    crew_id, member_id, kind, category, amount_cents, description, idempotency_key, created_by
  ) values (
    p_crew_id, p_member_id, 'payout', 'withdrawal', -p_amount_cents, trim(p_description), effective_key, actor_id
  )
  on conflict (idempotency_key) do nothing
  returning * into entry;

  if entry.id is null then
    select * into entry from public.ledger_entries where idempotency_key = effective_key;
  end if;
  return entry;
end;
$$;

create function public.record_bank_transaction(
  p_crew_id uuid,
  p_member_id uuid,
  p_direction text,
  p_category text,
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
  signed_amount integer;
  effective_key text := 'bank:' || p_crew_id::text || ':' || p_member_id::text || ':' || p_idempotency_key;
begin
  if not public.can_manage_crew(p_crew_id, actor_id) then raise exception 'Manager role required'; end if;
  if not public.is_crew_member(p_crew_id, p_member_id) then raise exception 'Member is not in this crew'; end if;
  if p_amount_cents <= 0 or p_amount_cents > 100000000 then raise exception 'Enter an amount between $0.01 and $1,000,000'; end if;
  if nullif(trim(p_description), '') is null then raise exception 'Description required'; end if;
  if char_length(trim(p_description)) > 160 then raise exception 'Description is too long'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Idempotency key required'; end if;

  if p_direction = 'deposit' then
    if p_category not in ('gift', 'allowance', 'deposit') then raise exception 'Invalid deposit category'; end if;
    signed_amount := p_amount_cents;
  elsif p_direction = 'withdrawal' then
    if p_category not in ('purchase', 'withdrawal') then raise exception 'Invalid withdrawal category'; end if;
    signed_amount := -p_amount_cents;
  else
    raise exception 'Direction must be deposit or withdrawal';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_crew_id::text || ':' || p_member_id::text, 0));

  select * into entry from public.ledger_entries where idempotency_key = effective_key;
  if entry.id is not null then return entry; end if;

  if signed_amount < 0 then
    select coalesce(sum(amount_cents), 0) into available_balance
    from public.ledger_entries
    where crew_id = p_crew_id and member_id = p_member_id;

    if abs(signed_amount) > available_balance then raise exception 'Purchase exceeds the bank balance'; end if;
  end if;

  insert into public.ledger_entries (
    crew_id, member_id, kind, category, amount_cents, description, idempotency_key, created_by
  ) values (
    p_crew_id, p_member_id, 'adjustment', p_category, signed_amount, trim(p_description), effective_key, actor_id
  )
  returning * into entry;

  return entry;
end;
$$;

create function public.set_bank_balance(
  p_crew_id uuid,
  p_member_id uuid,
  p_target_cents integer,
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
  current_balance integer;
  difference integer;
  effective_key text := 'balance:' || p_crew_id::text || ':' || p_member_id::text || ':' || p_idempotency_key;
begin
  if not public.can_manage_crew(p_crew_id, actor_id) then raise exception 'Manager role required'; end if;
  if not public.is_crew_member(p_crew_id, p_member_id) then raise exception 'Member is not in this crew'; end if;
  if p_target_cents < 0 or p_target_cents > 100000000 then raise exception 'Balance must be between $0 and $1,000,000'; end if;
  if nullif(trim(p_description), '') is null then raise exception 'Description required'; end if;
  if char_length(trim(p_description)) > 160 then raise exception 'Description is too long'; end if;
  if nullif(trim(p_idempotency_key), '') is null then raise exception 'Idempotency key required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_crew_id::text || ':' || p_member_id::text, 0));

  select * into entry from public.ledger_entries where idempotency_key = effective_key;
  if entry.id is not null then return entry; end if;

  select coalesce(sum(amount_cents), 0) into current_balance
  from public.ledger_entries
  where crew_id = p_crew_id and member_id = p_member_id;

  difference := p_target_cents - current_balance;
  if difference = 0 then raise exception 'The bank already has that balance'; end if;

  insert into public.ledger_entries (
    crew_id, member_id, kind, category, amount_cents, description, idempotency_key, created_by
  ) values (
    p_crew_id, p_member_id, 'adjustment', 'correction', difference, trim(p_description), effective_key, actor_id
  )
  returning * into entry;

  return entry;
end;
$$;

revoke all on function public.record_bank_transaction(uuid, uuid, text, text, integer, text, text) from public;
revoke all on function public.set_bank_balance(uuid, uuid, integer, text, text) from public;
grant execute on function public.record_bank_transaction(uuid, uuid, text, text, integer, text, text) to authenticated;
grant execute on function public.set_bank_balance(uuid, uuid, integer, text, text) to authenticated;

create or replace function public.notify_payout_recorded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_title text;
  notification_body text;
begin
  if new.kind not in ('payout', 'adjustment') then return new; end if;

  if new.category = 'correction' then
    notification_title := 'Bank balance corrected';
    notification_body := 'Your bank changed by ' || case when new.amount_cents > 0 then '+' else '-' end ||
      '$' || to_char(abs(new.amount_cents) / 100.0, 'FM999999990.00') || '.';
  elsif new.amount_cents > 0 then
    notification_title := 'Money added to your bank';
    notification_body := '$' || to_char(new.amount_cents / 100.0, 'FM999999990.00') || ' was added for ' || new.description || '.';
  else
    notification_title := 'Money taken from your bank';
    notification_body := '$' || to_char(abs(new.amount_cents) / 100.0, 'FM999999990.00') || ' was recorded for ' || new.description || '.';
  end if;

  insert into public.notifications(
    crew_id, recipient_id, kind, title, body, ledger_entry_id, dedupe_key
  ) values (
    new.crew_id,
    new.member_id,
    'payout_recorded',
    notification_title,
    notification_body,
    new.id,
    'bank_activity:' || new.id::text
  )
  on conflict (recipient_id, dedupe_key) do nothing;

  return new;
end;
$$;

comment on view public.bank_balances is
  'Current family-bank balances calculated from the complete append-only ledger.';
comment on function public.record_bank_transaction(uuid, uuid, text, text, integer, text, text) is
  'Manager-only deposit and withdrawal entry point with balance and category validation.';
comment on function public.set_bank_balance(uuid, uuid, integer, text, text) is
  'Manager-only balance correction that appends the exact delta rather than rewriting history.';
