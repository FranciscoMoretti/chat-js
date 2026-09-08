CREATE TABLE "EveConversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ownerId" text NOT NULL,
	"operationId" uuid NOT NULL,
	"firstMessage" text NOT NULL,
	"sessionId" text,
	"state" text DEFAULT 'creating' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "EveConversation_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "EveConversation_owner_operation" ON "EveConversation" USING btree ("ownerId","operationId");