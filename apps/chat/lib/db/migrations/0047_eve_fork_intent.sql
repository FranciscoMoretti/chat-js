ALTER TABLE "EveConversation" DROP CONSTRAINT "EveConversation_copy_root";--> statement-breakpoint
ALTER TABLE "EveConversation" DROP CONSTRAINT "EveConversation_fork_shape";--> statement-breakpoint
ALTER TABLE "EveConversation" ADD COLUMN "forkKind" text;--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_fork_kind" CHECK ("EveConversation"."forkKind" is null or "EveConversation"."forkKind" in ('edit', 'regenerate', 'comparison'));--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_copy_root" CHECK ("EveConversation"."creationKind" <> 'copy' or (
      "EveConversation"."parentConversationId" is null and "EveConversation"."rootConversationId" is null and
      "EveConversation"."forkTurnId" is null and "EveConversation"."forkMessageId" is null and "EveConversation"."forkCheckpointId" is null and
      "EveConversation"."forkKind" is null
    ));--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_fork_shape" CHECK ((
      "EveConversation"."parentConversationId" is null and "EveConversation"."rootConversationId" is null and
      "EveConversation"."forkTurnId" is null and "EveConversation"."forkMessageId" is null and "EveConversation"."forkKind" is null
    ) or (
      "EveConversation"."parentConversationId" is not null and "EveConversation"."rootConversationId" is not null and
      (
        ("EveConversation"."forkTurnId" is not null and "EveConversation"."forkTurnId" ~ '^turn_(0|[1-9][0-9]*)$' and "EveConversation"."forkMessageId" is null) or
        ("EveConversation"."forkMessageId" is not null and "EveConversation"."forkMessageId" ~ '^seed_message_(0|[1-9][0-9]{0,3})$' and "EveConversation"."forkTurnId" is null)
      ) and
      "EveConversation"."parentConversationId" <> "EveConversation"."id" and "EveConversation"."rootConversationId" <> "EveConversation"."id"
    ));