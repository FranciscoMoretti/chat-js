CREATE TABLE "EveFollowup" (
	"chatId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"turnId" text NOT NULL,
	"sessionId" text NOT NULL,
	"eventId" text PRIMARY KEY NOT NULL,
	"suggestions" jsonb,
	CONSTRAINT "EveFollowup_sessionId_turnId_unique" UNIQUE("sessionId","turnId")
);
--> statement-breakpoint
ALTER TABLE "EveFollowup" ADD CONSTRAINT "EveFollowup_chatId_ownerId_EveChat_id_ownerId_fk" FOREIGN KEY ("chatId","ownerId") REFERENCES "public"."EveChat"("id","ownerId") ON DELETE cascade ON UPDATE no action;