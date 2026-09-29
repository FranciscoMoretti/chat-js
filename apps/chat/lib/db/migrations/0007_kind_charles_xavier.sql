CREATE TABLE "EveSubagentSession" (
	"sessionId" text PRIMARY KEY NOT NULL,
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"parentSessionId" text NOT NULL,
	"rootTurnId" text NOT NULL,
	"usageStreamIndex" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "EveSubagentSession_not_self" CHECK ("EveSubagentSession"."sessionId" <> "EveSubagentSession"."parentSessionId"),
	CONSTRAINT "EveSubagentSession_cursor" CHECK ("EveSubagentSession"."usageStreamIndex" >= 0)
);
--> statement-breakpoint
ALTER TABLE "EveSubagentSession" ADD CONSTRAINT "EveSubagentSession_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "EveSubagentSession_conversation" ON "EveSubagentSession" USING btree ("conversationId");