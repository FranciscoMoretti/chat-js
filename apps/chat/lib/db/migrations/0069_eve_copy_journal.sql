CREATE TABLE "EveConversationCopy" (
	"conversationId" uuid PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"sourceConversationId" uuid NOT NULL,
	"sourceSessionId" text NOT NULL,
	"sourceOwnerId" text NOT NULL,
	"projectionHash" text NOT NULL,
	"planHash" text NOT NULL,
	"plan" jsonb,
	"seed" jsonb,
	"phase" text DEFAULT 'preparing' NOT NULL,
	"documentsReady" boolean DEFAULT false NOT NULL,
	"acceptedAt" timestamp,
	CONSTRAINT "EveConversationCopy_phase_payload" CHECK ((
    "EveConversationCopy"."phase" = 'preparing' and "EveConversationCopy"."plan" is not null and "EveConversationCopy"."seed" is null and "EveConversationCopy"."acceptedAt" is null
  ) or (
    "EveConversationCopy"."phase" = 'accepted' and "EveConversationCopy"."plan" is null and "EveConversationCopy"."seed" is not null and "EveConversationCopy"."acceptedAt" is not null and "EveConversationCopy"."documentsReady"
  ) or (
    "EveConversationCopy"."phase" = 'bound' and "EveConversationCopy"."plan" is null and "EveConversationCopy"."seed" is null and "EveConversationCopy"."acceptedAt" is not null and "EveConversationCopy"."documentsReady"
  ) or (
    "EveConversationCopy"."phase" = 'rejected' and "EveConversationCopy"."plan" is null and "EveConversationCopy"."seed" is null and "EveConversationCopy"."acceptedAt" is null
  ))
);
--> statement-breakpoint
CREATE TABLE "EveConversationCopyFile" (
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"key" text NOT NULL,
	"sha256" text NOT NULL,
	"size" integer NOT NULL,
	"mediaType" text NOT NULL,
	"writtenAt" timestamp,
	CONSTRAINT "EveConversationCopyFile_conversationId_key_pk" PRIMARY KEY("conversationId","key"),
	CONSTRAINT "EveConversationCopyFile_size" CHECK ("EveConversationCopyFile"."size" > 0),
	CONSTRAINT "EveConversationCopyFile_hash" CHECK ("EveConversationCopyFile"."sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "EveConversationCopy" ADD CONSTRAINT "EveConversationCopy_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "EveConversationCopy_owner_identity" ON "EveConversationCopy" USING btree ("conversationId","ownerId");
--> statement-breakpoint
ALTER TABLE "EveConversationCopyFile" ADD CONSTRAINT "EveConversationCopyFile_copy_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversationCopy"("conversationId","ownerId") ON DELETE no action ON UPDATE no action;
