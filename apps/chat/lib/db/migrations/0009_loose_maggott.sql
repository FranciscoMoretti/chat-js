CREATE TABLE "EveMessageAnnotation" (
	"conversationId" uuid NOT NULL,
	"messageId" text NOT NULL,
	"operationIds" uuid[] NOT NULL,
	"ownerId" text NOT NULL,
	"selectedTool" text,
	"source" text NOT NULL,
	CONSTRAINT "EveMessageAnnotation_conversationId_messageId_pk" PRIMARY KEY("conversationId","messageId"),
	CONSTRAINT "EveMessageAnnotation_source" CHECK ("EveMessageAnnotation"."source" in ('submission', 'imported'))
);
--> statement-breakpoint
CREATE TABLE "EveSubmission" (
	"command" jsonb NOT NULL,
	"conversationId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"messageId" text,
	"operationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"selectedTool" text,
	"state" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "EveSubmission_ownerId_operationId_pk" PRIMARY KEY("ownerId","operationId"),
	CONSTRAINT "EveSubmission_state" CHECK ("EveSubmission"."state" in ('pending', 'uncertain', 'admitted', 'received', 'rejected', 'retired')),
	CONSTRAINT "EveSubmission_receipt" CHECK (("EveSubmission"."state" = 'received') = ("EveSubmission"."messageId" is not null))
);
--> statement-breakpoint
ALTER TABLE "EveMessageAnnotation" ADD CONSTRAINT "EveMessageAnnotation_conversationId_ownerId_EveConversation_id_ownerId_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveSubmission" ADD CONSTRAINT "EveSubmission_conversationId_ownerId_EveConversation_id_ownerId_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE cascade ON UPDATE no action;