#!/bin/bash
# Runs schema.sql (twice) and seed.sql against many plausible "legacy database"
# shapes. The point is to find the next failure before the user does.
cd /home/user/HomeBuild_Webapplication
PSQL="psql -h /tmp -p 5433 -U postgres -q"

TABLES="profiles projects project_members floor_plans site_updates site_update_photos ai_alerts milestones contractors contractor_assignments schedule_phases budget_entries cost_categories expenses invitations activity_log"

pass=0; fail=0
report() { # name
  local out
  out=$($PSQL -v ON_ERROR_STOP=1 -f supabase/schema.sql 2>&1 | grep -i "^psql.*ERROR" | head -1)
  if [ -n "$out" ]; then echo "  FAIL [$1] schema: ${out#*ERROR:  }"; fail=$((fail+1)); return; fi
  out=$($PSQL -v ON_ERROR_STOP=1 -f supabase/schema.sql 2>&1 | grep -i "^psql.*ERROR" | head -1)
  if [ -n "$out" ]; then echo "  FAIL [$1] re-run: ${out#*ERROR:  }"; fail=$((fail+1)); return; fi
  out=$($PSQL -v ON_ERROR_STOP=1 -f supabase/seed.sql 2>&1 | grep -i "^psql.*ERROR" | head -1)
  if [ -n "$out" ]; then echo "  FAIL [$1] seed:   ${out#*ERROR:  }"; fail=$((fail+1)); return; fi
  pass=$((pass+1))
}
reset() { $PSQL -c "drop schema public cascade; create schema public;" >/dev/null 2>&1; }

echo "=== 1. each table alone, minimal shape (id only) ==="
for t in $TABLES; do
  reset
  if [ "$t" = "profiles" ]; then
    $PSQL -c "create table public.$t (firebase_uid text primary key);" >/dev/null 2>&1
  else
    $PSQL -c "create table public.$t (id uuid primary key default gen_random_uuid());" >/dev/null 2>&1
  fi
  report "$t minimal"
done

echo "=== 2. each table alone, WRONG key name ==="
for t in $TABLES; do
  reset
  $PSQL -c "create table public.$t (legacy_key uuid primary key default gen_random_uuid(), name text);" >/dev/null 2>&1
  report "$t wrong-key"
done

echo "=== 3. each table alone, no primary key at all, with a row ==="
for t in $TABLES; do
  reset
  $PSQL -c "create table public.$t (name text); insert into public.$t values ('legacy');" >/dev/null 2>&1
  report "$t no-pk"
done

echo "=== 4. all tables at once, minimal ==="
reset
for t in $TABLES; do
  if [ "$t" = "profiles" ]; then
    $PSQL -c "create table public.$t (firebase_uid text primary key);" >/dev/null 2>&1
  else
    $PSQL -c "create table public.$t (id uuid primary key default gen_random_uuid());" >/dev/null 2>&1
  fi
done
report "all-minimal"

echo "=== 5. all tables at once, wrong key names ==="
reset
for t in $TABLES; do
  $PSQL -c "create table public.$t (legacy_key uuid primary key default gen_random_uuid());" >/dev/null 2>&1
done
report "all-wrong-key"

echo
echo "passed: $pass   failed: $fail"
