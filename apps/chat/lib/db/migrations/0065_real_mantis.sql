CREATE TABLE "EveResponseGroup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ownerId" text NOT NULL,
	"operationId" uuid NOT NULL,
	"inputHash" text NOT NULL,
	"candidates" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EveResponseGroup" ADD CONSTRAINT "EveResponseGroup_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "EveResponseGroup_owner_operation" ON "EveResponseGroup" USING btree ("ownerId","operationId");