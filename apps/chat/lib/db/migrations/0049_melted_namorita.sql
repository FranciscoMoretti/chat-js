ALTER TABLE "EveConversation" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "EveConversation" ADD COLUMN "isPinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "EveConversation" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "EveConversation" SET "updatedAt" = "createdAt";
