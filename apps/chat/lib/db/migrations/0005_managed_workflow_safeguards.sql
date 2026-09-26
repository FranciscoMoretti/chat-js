CREATE TABLE "EveWorkflowBackend" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"world" text NOT NULL,
	CONSTRAINT "EveWorkflowBackend_singleton" CHECK ("EveWorkflowBackend"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "eve_usage_reconciled_at" timestamp;
--> statement-breakpoint
-- Existing installs used PostgreSQL. Never silently reinterpret their run IDs.
INSERT INTO "EveWorkflowBackend" (id, world)
SELECT 1, '@workflow/world-postgres'
WHERE EXISTS (SELECT 1 FROM "EveConversation");
