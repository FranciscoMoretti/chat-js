CREATE TABLE "EveVote" (
	"conversationId" uuid NOT NULL,
	"messageId" text NOT NULL,
	"isUpvoted" boolean NOT NULL,
	CONSTRAINT "EveVote_conversationId_messageId_pk" PRIMARY KEY("conversationId","messageId")
);
--> statement-breakpoint
ALTER TABLE "EveVote" ADD CONSTRAINT "EveVote_conversationId_EveConversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."EveConversation"("id") ON DELETE cascade ON UPDATE no action;