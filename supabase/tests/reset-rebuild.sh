#!/bin/bash
# Proves the clean-slate path — reset.sql, schema.sql, seed.sql — recovers a
# database from any shape, including shapes the in-place upgrade cannot handle.
cd /home/user/HomeBuild_Webapplication
PSQL="psql -h /tmp -p 5433 -U postgres -q"

pass=0; fail=0
reset_db() { $PSQL -c "drop schema public cascade; create schema public;" >/dev/null 2>&1; }

rebuild() { # name
  local out
  for f in reset schema seed; do
    out=$($PSQL -v ON_ERROR_STOP=1 -f "supabase/$f.sql" 2>&1 | grep -i "^psql.*ERROR" | head -1)
    if [ -n "$out" ]; then echo "  FAIL [$1] $f: ${out#*ERROR:  }"; fail=$((fail+1)); return; fi
  done
  # reset must leave nothing behind, and schema must rebuild everything.
  local n
  n=$($PSQL -tc "select count(*) from information_schema.tables where table_schema='public' and table_name in ('profiles','projects','project_members','floor_plans','site_updates','site_update_photos','ai_alerts','milestones','contractors','contractor_assignments','schedule_phases','budget_entries','cost_categories','expenses','invitations','activity_log');" | tr -d ' ')
  if [ "$n" != "16" ]; then echo "  FAIL [$1] only $n/16 tables after rebuild"; fail=$((fail+1)); return; fi

  # And the app must be able to write.
  $PSQL -c "grant usage on schema public, auth, storage to app; grant all on all tables in schema public to app; grant execute on all functions in schema public, auth to app;" >/dev/null 2>&1
  out=$($PSQL -v ON_ERROR_STOP=1 2>&1 <<'SQL' | grep -i "ERROR" | head -1
set role app;
set request.jwt.claims = '{"sub":"uid-reset"}';
insert into public.profiles (firebase_uid, full_name, email, role)
values ('uid-reset','Reset','r@e.com','project_manager') on conflict do nothing;
select public.create_project('{"name":"Rebuilt","budget_total":"5000000","start_date":"2026-01-01","expected_completion":"2027-01-01"}'::jsonb);
SQL
)
  if [ -n "$out" ]; then echo "  FAIL [$1] runtime: ${out#*ERROR:  }"; fail=$((fail+1)); return; fi
  local counts
  counts=$($PSQL -tc "select (select count(*) from public.cost_categories c join public.projects p on p.id=c.project_id where p.name='Rebuilt')||'/'||(select count(*) from public.milestones m join public.projects p on p.id=m.project_id where p.name='Rebuilt')||'/'||(select count(*) from public.schedule_phases s join public.projects p on p.id=s.project_id where p.name='Rebuilt');" 2>/dev/null | tr -d ' ')
  if [ "$counts" != "6/6/11" ]; then echo "  FAIL [$1] templates: $counts"; fail=$((fail+1)); return; fi
  pass=$((pass+1))
}

echo "=== a. nothing there at all ==="
reset_db; rebuild "empty"

echo "=== b. a complete, current database ==="
reset_db
$PSQL -v ON_ERROR_STOP=1 -f supabase/schema.sql >/dev/null 2>&1
$PSQL -v ON_ERROR_STOP=1 -f supabase/seed.sql >/dev/null 2>&1
rebuild "current"

echo "=== c. legacy shapes the in-place upgrade struggles with ==="
reset_db
$PSQL <<'SQL' >/dev/null 2>&1
create table public.projects (project_id uuid primary key default gen_random_uuid(), name text, budget_total text);
insert into public.projects (name, budget_total) values ('Legacy','not-a-number');
create table public.schedule_phases (id uuid primary key default gen_random_uuid(), project_id uuid, sequence integer, name text, created_at timestamptz default now());
insert into public.schedule_phases (project_id, sequence, name) select null, s, 'P'||s from generate_series(1,11) s;
insert into public.schedule_phases (project_id, sequence, name) select null, s, 'P'||s from generate_series(1,11) s;
create table public.profiles (uid text primary key);
SQL
rebuild "legacy-mangled"

echo "=== d. a VIEW holding a table name (blocks the upgrade path) ==="
reset_db
$PSQL <<'SQL' >/dev/null 2>&1
create table public.src (id uuid primary key default gen_random_uuid(), name text);
create view public.expenses as select id, name from public.src;
create view public.milestones as select id, name from public.src;
SQL
rebuild "view-collision"

echo "=== e. tables wrapped in dependent views and foreign keys ==="
reset_db
$PSQL <<'SQL' >/dev/null 2>&1
create table public.projects (id uuid primary key default gen_random_uuid(), name text);
create table public.outside_table (id uuid primary key, project_id uuid references public.projects(id));
create view public.project_report as select id, name from public.projects;
insert into public.projects (name) values ('Legacy');
SQL
rebuild "dependent-objects"

echo "=== f. reset run twice in a row ==="
reset_db
$PSQL -v ON_ERROR_STOP=1 -f supabase/schema.sql >/dev/null 2>&1
out=$($PSQL -v ON_ERROR_STOP=1 -f supabase/reset.sql 2>&1 | grep -i "^psql.*ERROR" | head -1)
out2=$($PSQL -v ON_ERROR_STOP=1 -f supabase/reset.sql 2>&1 | grep -i "^psql.*ERROR" | head -1)
if [ -n "$out" ] || [ -n "$out2" ]; then echo "  FAIL [reset-twice] ${out}${out2}"; fail=$((fail+1));
else echo "  OK   [reset-twice] idempotent"; pass=$((pass+1)); fi

echo
echo "passed: $pass   failed: $fail"
