# Database migrations

## EVE development-history consolidation

`0046_eve_runtime.sql` replaces the unreleased EVE migration sequence that previously occupied `0046` through `0072`. Production and preview databases did not apply that sequence. Some isolated local development databases did, so the consolidated migration includes a compatibility gate instead of assuming every database starts at `0045`.

The migration handles each history explicitly:

| Existing history | Result |
| --- | --- |
| Main through `0045` | Creates the final EVE schema directly. |
| Complete old EVE sequence through `0072` | Leaves the schema and data unchanged, then lets Drizzle record the consolidated migration. |
| Partial old EVE sequence | Aborts before changing the schema or migration history. |

The complete-history check uses the exact timestamp and SHA-256 hash of the old `0072_oval_mulholland_black.sql` migration. That final marker proves the earlier steps completed because Drizzle processes this journal in order and records each migration only after it succeeds. Manually edited migration-history rows are not supported.

### Recovering a partially migrated local database

Preserve the database and finish the old sequence from the last commit that contains it, then return to the current branch and run the normal migration. Export `DATABASE_URL` for the intended isolated local database before these commands; if `DATABASE_MIGRATION_URL` is set, it must point to that same database. A new worktree does not inherit untracked environment files.

```bash
migration_source_dir=$(pwd)
migration_transition_parent=$(mktemp -d)
migration_transition_dir="$migration_transition_parent/checkout"
git worktree add "$migration_transition_dir" 01cdd884fb4e18fff8d278bd48d11df7ec55e6c1
cd "$migration_transition_dir"
bun install --frozen-lockfile
bun --filter @chatjs/chat db:migrate

cd "$migration_source_dir"
bun --filter @chatjs/chat db:migrate
git worktree remove "$migration_transition_dir"
```

Provide the same local development database variables to both migration runs. The second run recognizes the exact old final marker and preserves the existing EVE rows. Do not manually rewrite `drizzle.__drizzle_migrations`.
