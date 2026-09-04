# Upgrade tests

`schema.sql` was written against an empty database and shipped three failures
in a row on a real one — a missing column, duplicate rows, and a foreign key
pointing at a key column that did not exist. Each was found by the person
running it, not by me.

These scripts exist so that stops happening. They build a database in a
deliberately wrong shape, run `schema.sql` twice and `seed.sql` once against
it, and then check the app can still write — a script that completes but
leaves a database `create_project()` cannot use has not actually succeeded.

```bash
# Needs a local PostgreSQL on /tmp:5433 with the Supabase shims
# (auth.jwt(), storage.objects) and an `app` login role. See the harness
# at the top of each script.
./supabase/tests/upgrade-shapes.sh      # 50 shapes: each table minimal,
                                        # wrong key name, no primary key
./supabase/tests/upgrade-hard-cases.sh  # wrong column types, extra NOT NULL,
                                        # duplicates, view name collisions,
                                        # stale policies
./supabase/tests/reset-rebuild.sh       # the clean-slate path: reset.sql +
                                        # schema.sql + seed.sql from any shape
```

Both must print `failed: 0`. Add a case here for any upgrade failure reported
in the wild before fixing it, so the fix is proven against the thing that
actually broke.
