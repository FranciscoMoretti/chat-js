CREATE TABLE "EveCodeSandbox" (
	"name" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"conversationId" uuid NOT NULL,
	"callId" text NOT NULL,
	"state" text DEFAULT 'unresolved' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EveCodeSandbox" ADD CONSTRAINT "EveCodeSandbox_conversationId_ownerId_EveConversation_id_ownerId_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "EveCodeSandbox_conversation" ON "EveCodeSandbox" USING btree ("conversationId");