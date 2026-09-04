-- =============================================================================
-- HomeBuild — RESET
--
--   ####################################################################
--   #  THIS DELETES DATA. Every HomeBuild table is dropped, with every  #
--   #  row in it. There is no undo. Take a backup first if there is     #
--   #  anything in this database you would be sorry to lose.            #
--   ####################################################################
--
-- What this is for: starting clean. `schema.sql` repairs an existing database
-- in place, which is the right behaviour once there is real data — but it has
-- to reckon with whatever shape that database is already in, and if it is one
-- this script has not anticipated, repairing is slower than rebuilding.
--
-- Run this ONLY when the data is expendable — a prototype, or a database whose
-- contents came from seed.sql anyway.
--
--   1. reset.sql    ← you are here; wipes HomeBuild's tables
--   2. schema.sql   ← rebuilds them from scratch
--   3. seed.sql     ← puts the demo data back
--
-- WHAT IS NOT TOUCHED:
--   · Uploaded files. Storage buckets and their objects are left alone — only
--     the access policies are dropped, and schema.sql recreates them. Your
--     avatars and site photos survive.
--   · Firebase. Accounts, passwords and sign-in providers live there, not
--     here. Nobody is signed out and no login is lost.
--   · Anything in this database that HomeBuild did not create.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Storage policies first.
--
-- They call public.firebase_uid() and public.has_project_access(), so dropping
-- the functions with CASCADE would take them out anyway — but silently, and
-- CASCADE on a function is a blunt instrument when the policies live on a table
-- this script otherwise does not touch. Explicit is safer.
-- -----------------------------------------------------------------------------
drop policy if exists "signed-in users read site photos"   on storage.objects;
drop policy if exists "read site photos via project"       on storage.objects;
drop policy if exists "users upload their own site photos" on storage.objects;
drop policy if exists "upload site photos via project"     on storage.objects;
drop policy if exists "users delete their own site photos" on storage.objects;
drop policy if exists "delete own site photos"             on storage.objects;
drop policy if exists "avatars are readable by anyone"     on storage.objects;
drop policy if exists "users write their own avatar"       on storage.objects;
drop policy if exists "users replace their own avatar"     on storage.objects;

-- -----------------------------------------------------------------------------
-- Tables.
--
-- CASCADE handles the foreign keys between them, so the order does not matter
-- and a table missing from an older database is simply skipped. This also
-- removes their policies, triggers, indexes and constraints.
-- -----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.relname, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and c.relname in (
        'profiles','projects','project_members','floor_plans','site_updates',
        'site_update_photos','ai_alerts','milestones','contractors',
        'contractor_assignments','schedule_phases','budget_entries',
        'cost_categories','expenses','invitations','activity_log'
      )
  loop
    /* `drop table` refuses a view — "expenses is not a table" — and a name
       taken by a view is exactly the case that blocks schema.sql, so this has
       to clear those too. The catalogue says what each name actually holds. */
    execute format('drop %s if exists public.%I cascade',
      case r.relkind
        when 'v' then 'view'
        when 'm' then 'materialized view'
        when 'f' then 'foreign table'
        else 'table'
      end, r.relname);
    raise notice 'dropped % (%)', r.relname,
      case r.relkind when 'v' then 'view' when 'm' then 'materialized view'
                     when 'f' then 'foreign table' else 'table' end;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Functions.
--
-- Dropped after the tables, since several are referenced by the policies and
-- triggers that went with them. Signatures are spelled out because `drop
-- function name` is ambiguous where an older version of this schema left an
-- overload behind.
-- -----------------------------------------------------------------------------
drop function if exists public.advance_milestone(uuid, text)        cascade;
drop function if exists public.apply_project_templates(uuid)        cascade;
drop function if exists public.apply_finance_templates(uuid)        cascade; -- pre-rename
drop function if exists public.apply_schedule_forecast(uuid)        cascade;
drop function if exists public.claim_demo_projects()                cascade;
drop function if exists public.create_project(jsonb)                cascade;
drop function if exists public.dashboard_kpis()                     cascade;
drop function if exists public.dual_approval_threshold()            cascade;
drop function if exists public.has_project_access(uuid)             cascade;
drop function if exists public.is_project_manager(uuid)             cascade;
drop function if exists public.is_signed_in()                       cascade;
drop function if exists public.post_milestone_expense(uuid)         cascade;
drop function if exists public.recalc_project_rollups(uuid)         cascade;
drop function if exists public.resolve_alert(uuid, text, text)      cascade;
drop function if exists public.second_approve_milestone(uuid)       cascade;
drop function if exists public.select_floor_plan(uuid)              cascade;
drop function if exists public.trigger_recalc_rollups()             cascade;
drop function if exists public.touch_updated_at()                   cascade;

-- firebase_uid() last: everything above may depend on it.
drop function if exists public.firebase_uid()                       cascade;

commit;

-- Should print no rows. Anything listed here is a HomeBuild table that did not
-- drop, and schema.sql will run into it.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles','projects','project_members','floor_plans','site_updates',
    'site_update_photos','ai_alerts','milestones','contractors',
    'contractor_assignments','schedule_phases','budget_entries',
    'cost_categories','expenses','invitations','activity_log'
  )
order by table_name;
