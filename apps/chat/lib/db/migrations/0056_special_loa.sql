CREATE TABLE "EveStoredFile" (
	"key" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EveStoredFile" ADD CONSTRAINT "EveStoredFile_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "EveStoredFile_owner" ON "EveStoredFile" USING btree ("ownerId");