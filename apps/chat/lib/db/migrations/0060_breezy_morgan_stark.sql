CREATE UNIQUE INDEX "Project_id_user_idx" ON "Project" USING btree ("id","userId");
--> statement-breakpoint
CREATE TABLE "EveConversationProject" (
	"conversationId" uuid PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"projectId" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EveConversationProject" ADD CONSTRAINT "EveConversationProject_conversationId_ownerId_EveConversation_id_ownerId_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveConversationProject" ADD CONSTRAINT "EveConversationProject_projectId_ownerId_Project_id_userId_fk" FOREIGN KEY ("projectId","ownerId") REFERENCES "public"."Project"("id","userId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "EveConversationProject_project" ON "EveConversationProject" USING btree ("projectId");
