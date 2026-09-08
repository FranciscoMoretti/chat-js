CREATE TABLE "EveUsage" (
	"eventId" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"turnId" text NOT NULL,
	"ownerId" text NOT NULL,
	"costUsd" numeric(24, 12),
	"chargedCents" integer DEFAULT 0 NOT NULL,
	"generationId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EveUsage" ADD CONSTRAINT "EveUsage_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "EveUsage_session_turn" ON "EveUsage" USING btree ("sessionId","turnId");