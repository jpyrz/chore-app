begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(25);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.ledger_entries'::regclass),
  'ledger entries have row-level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.managed_profile_credentials'::regclass),
  'managed PIN credentials have row-level security enabled'
);
select ok(
  not has_table_privilege('authenticated', 'public.ledger_entries', 'INSERT'),
  'browser users cannot write ledger rows directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.ledger_entries', 'UPDATE'),
  'browser users cannot rewrite ledger rows'
);
select ok(
  not has_table_privilege('authenticated', 'public.crew_members', 'UPDATE'),
  'browser users cannot promote themselves directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.crew_members', 'DELETE'),
  'browser users cannot remove memberships directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.managed_profile_credentials', 'SELECT'),
  'browser users cannot read PIN hashes'
);
select ok(
  has_function_privilege('authenticated', 'public.approve_chore(uuid,text)', 'EXECUTE'),
  'authenticated managers can call the checked approval function'
);
select ok(
  has_function_privilege('authenticated', 'public.unclaim_chore(uuid,uuid)', 'EXECUTE'),
  'authenticated members can call the checked unclaim function'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.ledger_entries'::regclass
      and tgname = 'ledger_entries_append_only'
      and not tgisinternal
  ),
  'the append-only ledger trigger exists'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'chore_occurrences'
      and indexname = 'chore_occurrences_template_period_idx'
  ),
  'recurring jobs have a unique period guard'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass),
  'notifications have row-level security enabled'
);
select ok(
  not has_table_privilege('authenticated', 'public.notifications', 'INSERT'),
  'browser users cannot forge notifications'
);
select ok(
  not has_table_privilege('authenticated', 'public.notifications', 'UPDATE'),
  'browser users cannot rewrite notifications directly'
);
select ok(
  has_table_privilege('authenticated', 'public.notifications', 'SELECT'),
  'authenticated profiles can read notifications through RLS'
);
select ok(
  has_function_privilege('authenticated', 'public.mark_notification_read(uuid,uuid)', 'EXECUTE'),
  'authenticated profiles can call the checked read function'
);
select ok(
  has_function_privilege('authenticated', 'public.mark_all_notifications_read(uuid,uuid)', 'EXECUTE'),
  'authenticated profiles can call the checked mark-all-read function'
);
select ok(
  has_function_privilege('authenticated', 'public.record_bank_transaction(uuid,uuid,text,text,integer,text,text)', 'EXECUTE'),
  'authenticated managers can call the checked bank transaction function'
);
select ok(
  has_function_privilege('authenticated', 'public.set_bank_balance(uuid,uuid,integer,text,text)', 'EXECUTE'),
  'authenticated managers can call the checked balance correction function'
);
select ok(
  has_table_privilege('authenticated', 'public.bank_balances', 'SELECT'),
  'authenticated profiles can read bank balances through the security-invoker view'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.chore_occurrences'::regclass
      and tgname = 'chore_occurrence_notify_new_job'
      and not tgisinternal
  ),
  'new jobs create notifications'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.chore_occurrences'::regclass
      and tgname = 'chore_occurrence_notify_approval'
      and not tgisinternal
  ),
  'completed jobs notify managers for approval'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.chore_occurrences'::regclass
      and tgname = 'chore_occurrence_resolve_notifications'
      and not tgisinternal
  ),
  'claimed and approved jobs resolve stale notifications'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.ledger_entries'::regclass
      and tgname = 'ledger_entry_notify_payout'
      and not tgisinternal
  ),
  'payout ledger entries notify their recipients'
);
select is(
  (
    select count(*)::integer
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in (
        'crews', 'crew_members', 'chore_templates', 'chore_occurrences',
        'ledger_entries', 'savings_goals', 'notifications'
      )
  ),
  7,
  'Crew activity tables are published to Supabase Realtime'
);

select * from finish();
rollback;
