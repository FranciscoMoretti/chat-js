ALTER TABLE "EveConversation" ADD COLUMN "parentConversationId" uuid;--> statement-breakpoint
ALTER TABLE "EveConversation" ADD COLUMN "rootConversationId" uuid;--> statement-breakpoint
ALTER TABLE "EveConversation" ADD COLUMN "forkTurnId" text;--> statement-breakpoint
CREATE UNIQUE INDEX "EveConversation_id_owner" ON "EveConversation" USING btree ("id","ownerId");--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_parent_owner_fk" FOREIGN KEY ("parentConversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_root_owner_fk" FOREIGN KEY ("rootConversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "EveConversation_owner_root" ON "EveConversation" USING btree ("ownerId","rootConversationId");--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_fork_shape" CHECK ((
      "EveConversation"."parentConversationId" is null and "EveConversation"."rootConversationId" is null and "EveConversation"."forkTurnId" is null
    ) or (
      "EveConversation"."parentConversationId" is not null and "EveConversation"."rootConversationId" is not null and
      "EveConversation"."forkTurnId" is not null and "EveConversation"."forkTurnId" ~ '^turn_(0|[1-9][0-9]*)$' and
      "EveConversation"."parentConversationId" <> "EveConversation"."id" and "EveConversation"."rootConversationId" <> "EveConversation"."id"
    ));