import { sql } from "../lib/bindings";

await sql`CREATE SCHEMA IF NOT EXISTS chatjs`;
await sql`CREATE TABLE IF NOT EXISTS chatjs.conversations (
 conversation_id uuid PRIMARY KEY,
 owner_subject text NOT NULL,
 operation_id uuid NOT NULL,
 message text NOT NULL,
 session_id text UNIQUE,
 state text NOT NULL DEFAULT 'creating' CHECK (state IN ('creating', 'bound', 'uncertain')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_subject, operation_id),
 CHECK ((state = 'bound') = (session_id IS NOT NULL))
)`;
await sql.end();
