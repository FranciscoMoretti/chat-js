# EVE-only database baseline

`0000_eve_baseline.sql` is the complete schema for a new ChatJS database. It contains authentication, credits, projects, model preferences, MCP, and EVE runtime tables. It intentionally excludes the retired Chat, Message, Part, Vote, Document, Suggestion, and GenerationCancellation tables.

The migration runner accepts an empty database or a database already initialized with this exact baseline. It rejects earlier or modified Drizzle histories before running SQL. This keeps existing isolated development databases and their EVE data untouched.

To move to this baseline, back up the existing database and provision a fresh empty database. Point both `DATABASE_URL` and `DATABASE_MIGRATION_URL` at the new database, then run `bun db:migrate`. Keep the old database available with the Git revision that created it if its EVE data must be exported later. Do not rewrite `drizzle.__drizzle_migrations` or drop the old database as a migration shortcut.
