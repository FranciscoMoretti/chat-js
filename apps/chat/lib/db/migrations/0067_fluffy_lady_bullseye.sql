CREATE TABLE "EveNamedDocumentCheckpoint" (
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"checkpointId" uuid NOT NULL,
	"turnIndex" integer NOT NULL,
	CONSTRAINT "EveNamedDocumentCheckpoint_conversationId_checkpointId_pk" PRIMARY KEY("conversationId","checkpointId"),
	CONSTRAINT "EveNamedDocumentCheckpoint_turn_nonnegative" CHECK ("EveNamedDocumentCheckpoint"."turnIndex" >= 0)
);
--> statement-breakpoint
CREATE TABLE "EveNamedDocumentCheckpointEntry" (
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"checkpointId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"revisionId" uuid NOT NULL,
	CONSTRAINT "EveNamedDocumentCheckpointEntry_conversationId_checkpointId_documentId_pk" PRIMARY KEY("conversationId","checkpointId","documentId")
);
--> statement-breakpoint
ALTER TABLE "EveConversation" ADD COLUMN "forkCheckpointId" uuid;--> statement-breakpoint
ALTER TABLE "EveNamedDocumentCheckpoint" ADD CONSTRAINT "EveNamedDocumentCheckpoint_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "EveNamedDocumentCheckpoint_owner_identity" ON "EveNamedDocumentCheckpoint" USING btree ("conversationId","checkpointId","ownerId");--> statement-breakpoint
ALTER TABLE "EveNamedDocumentCheckpointEntry" ADD CONSTRAINT "EveNamedDocumentCheckpointEntry_checkpoint_owner_fk" FOREIGN KEY ("conversationId","checkpointId","ownerId") REFERENCES "public"."EveNamedDocumentCheckpoint"("conversationId","checkpointId","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveNamedDocumentCheckpointEntry" ADD CONSTRAINT "EveNamedDocumentCheckpointEntry_revision_owner_fk" FOREIGN KEY ("revisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_named_fork_shape" CHECK ("EveConversation"."forkCheckpointId" is null or "EveConversation"."parentConversationId" is not null);