CREATE TABLE "EveDispatch" (
	"ownerId" text NOT NULL,
	"operationId" uuid NOT NULL,
	"conversationId" uuid NOT NULL,
	"kind" text NOT NULL,
	"intent" jsonb NOT NULL,
	"sessionId" text,
	"deliveryId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "EveDispatch_ownerId_operationId_pk" PRIMARY KEY("ownerId","operationId"),
	CONSTRAINT "EveDispatch_kind" CHECK ("EveDispatch"."kind" in ('create', 'copy', 'send')),
	CONSTRAINT "EveDispatch_binding" CHECK ("EveDispatch"."deliveryId" is null or "EveDispatch"."sessionId" is not null)
);
--> statement-breakpoint
ALTER TABLE "EveDispatch" ADD CONSTRAINT "EveDispatch_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveDispatch" ADD CONSTRAINT "EveDispatch_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;