ALTER TABLE "EveConversation" DROP CONSTRAINT "EveConversation_fork_shape";--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_fork_shape" CHECK ((
      "EveConversation"."parentConversationId" is null and "EveConversation"."rootConversationId" is null and
      "EveConversation"."forkTurnId" is null and "EveConversation"."forkMessageId" is null and "EveConversation"."forkKind" is null
    ) or (
      "EveConversation"."parentConversationId" is not null and "EveConversation"."rootConversationId" is not null and
      (
        ("EveConversation"."forkTurnId" is null and "EveConversation"."forkMessageId" is null) or
        ("EveConversation"."forkTurnId" is not null and "EveConversation"."forkTurnId" ~ '^turn_(0|[1-9][0-9]*)$' and "EveConversation"."forkMessageId" is null) or
        ("EveConversation"."forkMessageId" is not null and length("EveConversation"."forkMessageId") between 1 and 512 and "EveConversation"."forkTurnId" is null)
      ) and
      "EveConversation"."parentConversationId" <> "EveConversation"."id" and "EveConversation"."rootConversationId" <> "EveConversation"."id"
    ));