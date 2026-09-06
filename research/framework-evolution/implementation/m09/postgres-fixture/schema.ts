import type postgres from "postgres";

export async function initialize(sql: postgres.Sql, history: boolean) {
	await sql`CREATE SCHEMA IF NOT EXISTS chatjs`;
	// M07 688c7e94 / PR318 1b47cffe columns and constraints, plus lifecycle marker.
	await sql`CREATE TABLE IF NOT EXISTS chatjs.conversations (
    conversation_id uuid PRIMARY KEY,
    owner_subject text NOT NULL,
    operation_id uuid NOT NULL,
    message text NOT NULL,
    session_id text UNIQUE,
    state text NOT NULL DEFAULT 'creating' CHECK(state IN ('creating','bound','uncertain')),
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE(owner_subject,operation_id),
    CHECK((state = 'bound') = (session_id IS NOT NULL))
  )`;
	if (history)
		await sql`CREATE TABLE IF NOT EXISTS chatjs.saved_conversations (
    conversation_id uuid PRIMARY KEY REFERENCES chatjs.conversations(conversation_id) ON DELETE RESTRICT,
    title text NOT NULL DEFAULT 'New conversation' CHECK(length(btrim(title)) BETWEEN 1 AND 255),
    is_pinned boolean NOT NULL DEFAULT false,
    saved_at timestamptz NOT NULL DEFAULT now(),
    activity_at timestamptz NOT NULL DEFAULT now(),
    revision integer NOT NULL DEFAULT 0 CHECK(revision >= 0)
  )`;
}
