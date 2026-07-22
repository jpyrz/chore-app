begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(10);

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

select * from finish();
rollback;
