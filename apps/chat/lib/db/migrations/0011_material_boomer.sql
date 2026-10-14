ALTER TABLE "EveConversation" ADD COLUMN "modelAccountingState" text DEFAULT 'unprepared' NOT NULL;--> statement-breakpoint
ALTER TABLE "EveUsage" ADD COLUMN "modelAttempt" jsonb;