-- Preserve the original browser recovery scope before retiring the redundant column.
-- Pending HTTP requests already include projectId. Older partial requests receive
-- only their known assignment; missing message/model content is never invented.
UPDATE "EveConversation"
SET "initialRequest" = COALESCE("initialRequest", '{}'::jsonb)
  || jsonb_build_object('projectId', "initialProjectId")
WHERE "initialProjectId" IS NOT NULL
  AND "state" IN ('creating', 'uncertain')
  AND ("initialRequest" IS NULL OR jsonb_typeof("initialRequest") = 'object')
  AND NOT COALESCE("initialRequest" ? 'projectId', false);
--> statement-breakpoint
ALTER TABLE "EveConversation" DROP COLUMN "initialProjectId";
