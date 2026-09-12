CREATE TABLE "EveImportedDocumentCheckpoint" (
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"messageIndex" integer NOT NULL,
	CONSTRAINT "EveImportedDocumentCheckpoint_conversationId_messageIndex_pk" PRIMARY KEY("conversationId","messageIndex"),
	CONSTRAINT "EveImportedDocumentCheckpoint_message_range" CHECK ("EveImportedDocumentCheckpoint"."messageIndex" between 0 and 9999)
);
--> statement-breakpoint
CREATE TABLE "EveImportedDocumentCheckpointEntry" (
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"messageIndex" integer NOT NULL,
	"documentId" uuid NOT NULL,
	"revisionId" uuid NOT NULL,
	CONSTRAINT "EveImportedDocumentCheckpointEntry_conversationId_messageIndex_documentId_pk" PRIMARY KEY("conversationId","messageIndex","documentId")
);
--> statement-breakpoint
ALTER TABLE "EveConversation" DROP CONSTRAINT "EveConversation_copy_root";--> statement-breakpoint
ALTER TABLE "EveConversation" DROP CONSTRAINT "EveConversation_named_fork_shape";--> statement-breakpoint
ALTER TABLE "EveConversation" DROP CONSTRAINT "EveConversation_fork_shape";--> statement-breakpoint
ALTER TABLE "EveConversation" ADD COLUMN "forkMessageId" text;--> statement-breakpoint
ALTER TABLE "EveImportedDocumentCheckpoint" ADD CONSTRAINT "EveImportedDocumentCheckpoint_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "EveImportedDocumentCheckpoint_owner_identity" ON "EveImportedDocumentCheckpoint" USING btree ("conversationId","messageIndex","ownerId");--> statement-breakpoint
ALTER TABLE "EveImportedDocumentCheckpointEntry" ADD CONSTRAINT "EveImportedDocumentCheckpointEntry_checkpoint_owner_fk" FOREIGN KEY ("conversationId","messageIndex","ownerId") REFERENCES "public"."EveImportedDocumentCheckpoint"("conversationId","messageIndex","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveImportedDocumentCheckpointEntry" ADD CONSTRAINT "EveImportedDocumentCheckpointEntry_revision_owner_fk" FOREIGN KEY ("revisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_copy_root" CHECK ("EveConversation"."creationKind" <> 'copy' or (
      "EveConversation"."parentConversationId" is null and "EveConversation"."rootConversationId" is null and
      "EveConversation"."forkTurnId" is null and "EveConversation"."forkMessageId" is null and "EveConversation"."forkCheckpointId" is null
    ));--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_named_fork_shape" CHECK ("EveConversation"."forkCheckpointId" is null or (
      "EveConversation"."parentConversationId" is not null and "EveConversation"."forkMessageId" is null
    ));--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_fork_shape" CHECK ((
      "EveConversation"."parentConversationId" is null and "EveConversation"."rootConversationId" is null and
      "EveConversation"."forkTurnId" is null and "EveConversation"."forkMessageId" is null
    ) or (
      "EveConversation"."parentConversationId" is not null and "EveConversation"."rootConversationId" is not null and
      (
        ("EveConversation"."forkTurnId" is not null and "EveConversation"."forkTurnId" ~ '^turn_(0|[1-9][0-9]*)$' and "EveConversation"."forkMessageId" is null) or
        ("EveConversation"."forkMessageId" is not null and "EveConversation"."forkMessageId" ~ '^seed_message_(0|[1-9][0-9]{0,3})$' and "EveConversation"."forkTurnId" is null)
      ) and
      "EveConversation"."parentConversationId" <> "EveConversation"."id" and "EveConversation"."rootConversationId" <> "EveConversation"."id"
    ));