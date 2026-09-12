ALTER TABLE "EveConversation" ADD COLUMN "creationKind" text DEFAULT 'message' NOT NULL;--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_creation_kind" CHECK ("EveConversation"."creationKind" in ('message', 'copy'));--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_copy_root" CHECK ("EveConversation"."creationKind" <> 'copy' or (
      "EveConversation"."parentConversationId" is null and "EveConversation"."rootConversationId" is null and
      "EveConversation"."forkTurnId" is null and "EveConversation"."forkCheckpointId" is null
    ));