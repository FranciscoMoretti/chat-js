CREATE UNIQUE INDEX "EveStoredFile_key_owner" ON "EveStoredFile" USING btree ("key","ownerId");
--> statement-breakpoint
CREATE TABLE "EveFileReference" (
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"key" text NOT NULL,
	CONSTRAINT "EveFileReference_conversationId_key_pk" PRIMARY KEY("conversationId","key")
);
--> statement-breakpoint
ALTER TABLE "EveFileReference" ADD CONSTRAINT "EveFileReference_conversationId_ownerId_EveConversation_id_ownerId_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveFileReference" ADD CONSTRAINT "EveFileReference_key_ownerId_EveStoredFile_key_ownerId_fk" FOREIGN KEY ("key","ownerId") REFERENCES "public"."EveStoredFile"("key","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "EveFileReference_key" ON "EveFileReference" USING btree ("key");--> statement-breakpoint
