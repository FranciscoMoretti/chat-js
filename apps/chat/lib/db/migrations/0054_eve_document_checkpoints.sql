CREATE TABLE "EveDocumentCheckpoint" (
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"turnIndex" integer NOT NULL,
	CONSTRAINT "EveDocumentCheckpoint_conversationId_turnIndex_pk" PRIMARY KEY("conversationId","turnIndex"),
	CONSTRAINT "EveDocumentCheckpoint_turn_nonnegative" CHECK ("EveDocumentCheckpoint"."turnIndex" >= 0)
);
--> statement-breakpoint
CREATE TABLE "EveDocumentCheckpointEntry" (
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"turnIndex" integer NOT NULL,
	"documentId" uuid NOT NULL,
	"revisionId" uuid NOT NULL,
	CONSTRAINT "EveDocumentCheckpointEntry_conversationId_turnIndex_documentId_pk" PRIMARY KEY("conversationId","turnIndex","documentId")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "EveDocumentCheckpoint_owner_identity" ON "EveDocumentCheckpoint" USING btree ("conversationId","turnIndex","ownerId");
--> statement-breakpoint
ALTER TABLE "EveDocumentCheckpoint" ADD CONSTRAINT "EveDocumentCheckpoint_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveDocumentCheckpointEntry" ADD CONSTRAINT "EveDocumentCheckpointEntry_checkpoint_owner_fk" FOREIGN KEY ("conversationId","turnIndex","ownerId") REFERENCES "public"."EveDocumentCheckpoint"("conversationId","turnIndex","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveDocumentCheckpointEntry" ADD CONSTRAINT "EveDocumentCheckpointEntry_revision_owner_fk" FOREIGN KEY ("revisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint