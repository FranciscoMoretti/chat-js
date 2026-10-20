-- Workspace ownership is a clean-state transition. Never guess existing resource membership.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "EveConversation")
    OR EXISTS (SELECT 1 FROM "EveSandboxSession")
    OR EXISTS (SELECT 1 FROM "EvePersistentSandbox") THEN
    RAISE EXCEPTION 'Shared workspaces require a fresh EVE database. Existing conversations and resources must be retained and drained separately; this migration will not regroup or erase them.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "EveWorkspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ownerId" text NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"activeOperationId" uuid,
	CONSTRAINT "EveWorkspace_id_owner" UNIQUE("id","ownerId")
);
--> statement-breakpoint
CREATE TABLE "EveWorkspaceAttachment" (
	"workspaceId" uuid NOT NULL,
	"fileKey" text NOT NULL,
	"ownerId" text NOT NULL,
	"sha256" text NOT NULL,
	"paths" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "EveWorkspaceAttachment_workspaceId_fileKey_pk" PRIMARY KEY("workspaceId","fileKey")
);
--> statement-breakpoint
ALTER TABLE "EveConversationCopy" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "EveConversationCopyFile" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "EveConversationCopy" CASCADE;--> statement-breakpoint
DROP TABLE "EveConversationCopyFile" CASCADE;--> statement-breakpoint
ALTER TABLE "EveConversation" DROP CONSTRAINT "EveConversation_copy_root";--> statement-breakpoint
ALTER TABLE "EvePersistentSandbox" DROP CONSTRAINT "EvePersistentSandbox_sessionId_EveSandboxSession_sessionId_fk";
--> statement-breakpoint
DROP INDEX "EvePersistentSandbox_session";--> statement-breakpoint
ALTER TABLE "EveConversation" ADD COLUMN "workspaceId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "EvePersistentSandbox" ADD COLUMN "workspaceId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "EveSandboxSession" ADD COLUMN "conversationId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "EveSandboxSession" ADD COLUMN "workspaceId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "EveWorkspace" ADD CONSTRAINT "EveWorkspace_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveWorkspaceAttachment" ADD CONSTRAINT "EveWorkspaceAttachment_workspace_owner_fk" FOREIGN KEY ("workspaceId","ownerId") REFERENCES "public"."EveWorkspace"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveWorkspaceAttachment" ADD CONSTRAINT "EveWorkspaceAttachment_file_owner_fk" FOREIGN KEY ("fileKey","ownerId") REFERENCES "public"."EveStoredFile"("key","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "EveWorkspaceAttachment_file" ON "EveWorkspaceAttachment" USING btree ("fileKey");--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_workspace_owner_fk" FOREIGN KEY ("workspaceId","ownerId") REFERENCES "public"."EveWorkspace"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EvePersistentSandbox" ADD CONSTRAINT "EvePersistentSandbox_workspaceId_EveWorkspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."EveWorkspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveSandboxSession" ADD CONSTRAINT "EveSandboxSession_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveSandboxSession" ADD CONSTRAINT "EveSandboxSession_workspace_owner_fk" FOREIGN KEY ("workspaceId","ownerId") REFERENCES "public"."EveWorkspace"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "EveConversation_workspace" ON "EveConversation" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "EveSandboxSession_workspace" ON "EveSandboxSession" USING btree ("workspaceId");--> statement-breakpoint
ALTER TABLE "EvePersistentSandbox" DROP COLUMN "sessionId";--> statement-breakpoint
ALTER TABLE "EvePersistentSandbox" ADD CONSTRAINT "EvePersistentSandbox_workspace" UNIQUE("workspaceId");
