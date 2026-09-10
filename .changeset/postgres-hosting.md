---
"@chat-js/cli": minor
---

Make generated Postgres setup independent of the database host. Support a separate
schema connection and runtime pooling options, run explicit migrations without
Vercel environment flags, and expose Neon branching through opt-in commands.

Guide Postgres setup by host and add an explicit, read-only `db:connect` check.
