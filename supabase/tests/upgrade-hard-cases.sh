#!/bin/bash
# Round 2: nastier legacy shapes, and a RUNTIME check after each upgrade —
# a script that completes but leaves a database the app cannot write to has
# not actually succeeded.
cd /home/user/HomeBuild_Webapplication
PSQL="psql -h /tmp -p 5433 -U postgres -q"

pass=0; fail=0
reset() { $PSQL -c "drop schema public cascade; create schema public;" >/dev/null 2>&1; }

check() { # name
  local out
  out=$($PSQL -v ON_ERROR_STOP=1 -f supabase/schema.sql 2>&1 | grep -i "^psql.*ERROR" | head -1)
  if [ -n "$out" ]; then echo "  FAIL [$1] schema: ${out#*ERROR:  }"; fail=$((fail+1)); return; fi
  out=$($PSQL -v ON_ERROR_STOP=1 -f supabase/schema.sql 2>&1 | grep -i "^psql.*ERROR" | head -1)
  if [ -n "$out" ]; then echo "  FAIL [$1] re-run: ${out#*ERROR:  }"; fail=$((fail+1)); return; fi
  out=$($PSQL -v ON_ERROR_STOP=1 -f supabase/seed.sql 2>&1 | grep -i "^psql.*ERROR" | head -1)
  if [ -n "$out" ]; then echo "  FAIL [$1] seed:   ${out#*ERROR:  }"; fail=$((fail+1)); return; fi

  # Runtime: can the app still create a project and get its templates?
  $PSQL -c "grant usage on schema public, auth, storage to app; grant all on all tables in schema public to app; grant execute on all functions in schema public, auth to app;" >/dev/null 2>&1
  out=$($PSQL -v ON_ERROR_STOP=1 2>&1 <<'SQL' | grep -i "ERROR" | head -1
set role app;
set request.jwt.claims = '{"sub":"uid-fuzz"}';
insert into public.profiles (firebase_uid, full_name, email, role)
values ('uid-fuzz','Fuzz','f@e.com','project_manager') on conflict do nothing;
select public.create_project('{"name":"Fuzz Project","budget_total":"5000000","start_date":"2026-01-01","expected_completion":"2027-01-01"}'::jsonb);
SQL
)
  if [ -n "$out" ]; then echo "  FAIL [$1] runtime: ${out#*ERROR:  }"; fail=$((fail+1)); return; fi

  local counts
  counts=$($PSQL -tc "select (select count(*) from public.cost_categories c join public.projects p on p.id=c.project_id where p.name='Fuzz Project')||'/'||(select count(*) from public.milestones m join public.projects p on p.id=m.project_id where p.name='Fuzz Project')||'/'||(select count(*) from public.schedule_phases s join public.projects p on p.id=s.project_id where p.name='Fuzz Project');" 2>/dev/null | tr -d ' ')
  if [ "$counts" != "6/6/11" ]; then
    echo "  FAIL [$1] templates: got $counts, expected 6/6/11"; fail=$((fail+1)); return
  fi
  pass=$((pass+1))
}

echo "=== 6. right column names, WRONG types ==="
reset
$PSQL <<'SQL' >/dev/null 2>&1
create table public.projects (id uuid primary key default gen_random_uuid(),
  name text, budget_total text, progress_pct text, start_date text);
create table public.schedule_phases (id uuid primary key default gen_random_uuid(),
  project_id uuid, sequence text, cost text);
insert into public.projects (name, budget_total) values ('Legacy','4500000');
SQL
check "wrong-types"

echo "=== 7. extra NOT NULL column the app never fills ==="
reset
$PSQL <<'SQL' >/dev/null 2>&1
create table public.projects (id uuid primary key default gen_random_uuid(),
  name text, legacy_owner text not null default 'unknown');
insert into public.projects (name) values ('Legacy');
SQL
check "extra-notnull"

echo "=== 8. everything wrong at once: rows, dupes, missing cols, no defaults ==="
reset
$PSQL <<'SQL' >/dev/null 2>&1
create table public.projects (id uuid primary key, name text, created_at timestamptz);
insert into public.projects values ('33333333-3333-3333-3333-333333333301','Legacy',now());
create table public.schedule_phases (id uuid primary key default gen_random_uuid(),
  project_id uuid, sequence integer, name text, created_at timestamptz default now());
insert into public.schedule_phases (project_id, sequence, name)
select '33333333-3333-3333-3333-333333333301', s, 'Phase '||s from generate_series(1,11) s;
insert into public.schedule_phases (project_id, sequence, name)
select '33333333-3333-3333-3333-333333333301', s, 'Phase '||s from generate_series(1,11) s;
create table public.milestones (id uuid primary key default gen_random_uuid(),
  project_id uuid, sequence integer, name text, created_at timestamptz default now());
insert into public.milestones (project_id, sequence, name) values
  ('33333333-3333-3333-3333-333333333301',1,'Foundation'),
  ('33333333-3333-3333-3333-333333333301',1,'Foundation');
create table public.profiles (firebase_uid text, full_name text);
insert into public.profiles values ('seed-old','Old');
SQL
check "kitchen-sink"

echo "=== 9. an existing VIEW shadowing a table name (must REFUSE clearly) ==="
reset
$PSQL <<'SQL' >/dev/null 2>&1
create table public.projects_real (id uuid primary key default gen_random_uuid(), name text);
create view public.expenses as select id, name from public.projects_real;
SQL
out=$($PSQL -v ON_ERROR_STOP=1 -f supabase/schema.sql 2>&1 | grep -i "already exist as something else" | head -1)
if [ -n "$out" ]; then echo "  OK   [view-shadow] refused with a clear message"; pass=$((pass+1));
else echo "  FAIL [view-shadow] did not refuse clearly"; fail=$((fail+1)); fi

echo "=== 10. stale policies and triggers under the same names ==="
reset
$PSQL <<'SQL' >/dev/null 2>&1
create table public.projects (id uuid primary key default gen_random_uuid(), name text);
alter table public.projects enable row level security;
create policy "read via project" on public.projects for select using (true);
create policy "signed-in read" on public.projects for select using (true);
SQL
check "stale-policies"

echo
echo "passed: $pass   failed: $fail"
