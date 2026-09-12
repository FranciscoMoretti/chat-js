ALTER TABLE "EveResponseGroup" ALTER COLUMN "inputHash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "EveResponseGroup" ALTER COLUMN "candidates" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "EveResponseGroup" ADD COLUMN "candidateOperationIds" uuid[];--> statement-breakpoint
UPDATE "EveResponseGroup" SET "candidateOperationIds" = ARRAY(SELECT (item->>'operationId')::uuid FROM jsonb_array_elements("candidates") AS item);--> statement-breakpoint
ALTER TABLE "EveResponseGroup" ALTER COLUMN "candidateOperationIds" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "EveResponseGroup" ADD COLUMN "sourceConversationId" uuid;--> statement-breakpoint
ALTER TABLE "EveResponseGroup" ADD COLUMN "sourceIdentityKnown" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "EveResponseGroup" ADD COLUMN "deleted" boolean DEFAULT false NOT NULL;