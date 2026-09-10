CREATE TABLE "EveDocumentHead" (
	"conversationId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"revisionId" uuid NOT NULL,
	CONSTRAINT "EveDocumentHead_conversationId_documentId_pk" PRIMARY KEY("conversationId","documentId")
);
--> statement-breakpoint
CREATE TABLE "EveDocumentRevision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"operationId" text NOT NULL,
	"parentRevisionId" uuid,
	"turnIndex" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"kind" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "EveDocumentRevision_turn_nonnegative" CHECK ("EveDocumentRevision"."turnIndex" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "EveDocumentRevision_operation" ON "EveDocumentRevision" USING btree ("conversationId","operationId");--> statement-breakpoint
CREATE UNIQUE INDEX "EveDocumentRevision_identity" ON "EveDocumentRevision" USING btree ("id","documentId","ownerId");
--> statement-breakpoint
ALTER TABLE "EveDocumentHead" ADD CONSTRAINT "EveDocumentHead_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveDocumentHead" ADD CONSTRAINT "EveDocumentHead_revision_document_owner_fk" FOREIGN KEY ("revisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveDocumentRevision" ADD CONSTRAINT "EveDocumentRevision_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveDocumentRevision" ADD CONSTRAINT "EveDocumentRevision_parent_document_owner_fk" FOREIGN KEY ("parentRevisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
