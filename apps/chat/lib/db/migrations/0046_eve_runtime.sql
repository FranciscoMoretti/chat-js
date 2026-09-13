-- This migration replaces the unreleased 0046-0072 EVE development sequence.
-- A local database that completed that sequence is already at this schema, so
-- preserve its data and only let Drizzle record this consolidated migration.
-- A partially migrated database must finish the old sequence before upgrading;
-- silently treating a partial schema as complete would be unsafe.
-- The exact final marker proves the linear old journal completed because
-- Drizzle records each migration only after it succeeds.
DO $eve_runtime$
DECLARE
	legacy_eve_migration_found boolean;
	legacy_eve_final_migration_found boolean;
BEGIN
	SELECT EXISTS (
		SELECT 1
		FROM "drizzle"."__drizzle_migrations"
		WHERE "created_at" BETWEEN 1788866915307 AND 1789290141016
	) INTO legacy_eve_migration_found;

	SELECT EXISTS (
		SELECT 1
		FROM "drizzle"."__drizzle_migrations"
		WHERE "created_at" = 1789290141016
			AND "hash" = '77eecfeabb65884e3f75de5289f306e9d5d2d7d354a6bcbd856e69178524abb3'
	) INTO legacy_eve_final_migration_found;

	IF legacy_eve_final_migration_found THEN
		RAISE NOTICE 'EVE development migrations 0046-0072 are already complete, preserving the existing schema and data';
		RETURN;
	END IF;

	IF legacy_eve_migration_found THEN
		RAISE EXCEPTION USING
			MESSAGE = 'Partial unreleased EVE migration history detected',
			HINT = 'Finish the old 0046-0072 sequence using commit 01cdd884fb4e18fff8d278bd48d11df7ec55e6c1, then rerun this migration. This preserves the local development data.';
	END IF;

-- Fresh databases at the main 0045 high-water mark create the final schema.
CREATE TABLE "EveCodeSandbox" (
	"callId" text NOT NULL,
	"conversationId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"creationConfirmed" boolean DEFAULT false NOT NULL,
	"name" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"state" text DEFAULT 'unresolved' NOT NULL
);
CREATE TABLE "EveConversation" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"creationKind" text DEFAULT 'message' NOT NULL,
	"firstMessage" text NOT NULL,
	"forkCheckpointId" uuid,
	"forkMessageId" text,
	"forkTurnId" text,
	"guestCleanupAttemptedAt" timestamp with time zone,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"initialContentHash" text,
	"initialModelId" text,
	"initialProjectId" uuid,
	"isPinned" boolean DEFAULT false NOT NULL,
	"operationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"parentConversationId" uuid,
	"rootConversationId" uuid,
	"sessionId" text,
	"state" text DEFAULT 'creating' NOT NULL,
	"title" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"usageStreamIndex" integer DEFAULT 0 NOT NULL,
	"visibility" varchar DEFAULT 'private' NOT NULL,
	CONSTRAINT "EveConversation_sessionId_unique" UNIQUE("sessionId"),
	CONSTRAINT "EveConversation_creation_kind" CHECK ("EveConversation"."creationKind" in ('message', 'copy')),
	CONSTRAINT "EveConversation_copy_root" CHECK ("EveConversation"."creationKind" <> 'copy' or (
      "EveConversation"."parentConversationId" is null and "EveConversation"."rootConversationId" is null and
      "EveConversation"."forkTurnId" is null and "EveConversation"."forkMessageId" is null and "EveConversation"."forkCheckpointId" is null
    )),
	CONSTRAINT "EveConversation_named_fork_shape" CHECK ("EveConversation"."forkCheckpointId" is null or (
      "EveConversation"."parentConversationId" is not null and "EveConversation"."forkMessageId" is null
    )),
	CONSTRAINT "EveConversation_fork_shape" CHECK ((
      "EveConversation"."parentConversationId" is null and "EveConversation"."rootConversationId" is null and
      "EveConversation"."forkTurnId" is null and "EveConversation"."forkMessageId" is null
    ) or (
      "EveConversation"."parentConversationId" is not null and "EveConversation"."rootConversationId" is not null and
      (
        ("EveConversation"."forkTurnId" is not null and "EveConversation"."forkTurnId" ~ '^turn_(0|[1-9][0-9]*)$' and "EveConversation"."forkMessageId" is null) or
        ("EveConversation"."forkMessageId" is not null and "EveConversation"."forkMessageId" ~ '^seed_message_(0|[1-9][0-9]{0,3})$' and "EveConversation"."forkTurnId" is null)
      ) and
      "EveConversation"."parentConversationId" <> "EveConversation"."id" and "EveConversation"."rootConversationId" <> "EveConversation"."id"
    ))
);
CREATE TABLE "EveConversationCopy" (
	"acceptedAt" timestamp,
	"conversationId" uuid PRIMARY KEY NOT NULL,
	"documentsReady" boolean DEFAULT false NOT NULL,
	"ownerId" text NOT NULL,
	"phase" text DEFAULT 'preparing' NOT NULL,
	"plan" jsonb,
	"planHash" text NOT NULL,
	"projectionHash" text NOT NULL,
	"seed" jsonb,
	"sourceConversationId" uuid NOT NULL,
	"sourceOwnerId" text NOT NULL,
	"sourceSessionId" text NOT NULL,
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
CREATE TABLE "EveConversationCopyFile" (
	"conversationId" uuid NOT NULL,
	"key" text NOT NULL,
	"mediaType" text NOT NULL,
	"ownerId" text NOT NULL,
	"sha256" text NOT NULL,
	"size" integer NOT NULL,
	"writtenAt" timestamp,
	CONSTRAINT "EveConversationCopyFile_conversationId_key_pk" PRIMARY KEY("conversationId","key"),
	CONSTRAINT "EveConversationCopyFile_size" CHECK ("EveConversationCopyFile"."size" > 0),
	CONSTRAINT "EveConversationCopyFile_hash" CHECK ("EveConversationCopyFile"."sha256" ~ '^[a-f0-9]{64}$')
);
CREATE TABLE "EveConversationProject" (
	"conversationId" uuid PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"projectId" uuid NOT NULL
);
CREATE TABLE "EveDocumentCheckpoint" (
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"turnIndex" integer NOT NULL,
	CONSTRAINT "EveDocumentCheckpoint_conversationId_turnIndex_pk" PRIMARY KEY("conversationId","turnIndex"),
	CONSTRAINT "EveDocumentCheckpoint_turn_nonnegative" CHECK ("EveDocumentCheckpoint"."turnIndex" >= 0)
);
CREATE TABLE "EveDocumentCheckpointEntry" (
	"conversationId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"revisionId" uuid NOT NULL,
	"turnIndex" integer NOT NULL,
	CONSTRAINT "EveDocumentCheckpointEntry_conversationId_turnIndex_documentId_pk" PRIMARY KEY("conversationId","turnIndex","documentId")
);
CREATE TABLE "EveDocumentHead" (
	"conversationId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"revisionId" uuid NOT NULL,
	CONSTRAINT "EveDocumentHead_conversationId_documentId_pk" PRIMARY KEY("conversationId","documentId")
);
CREATE TABLE "EveDocumentRevision" (
	"content" text NOT NULL,
	"conversationId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"documentId" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar NOT NULL,
	"operationId" text NOT NULL,
	"ownerId" text NOT NULL,
	"parentRevisionId" uuid,
	"title" text NOT NULL,
	"turnIndex" integer,
	CONSTRAINT "EveDocumentRevision_turn_nonnegative" CHECK ("EveDocumentRevision"."turnIndex" >= 0)
);
CREATE TABLE "EveFileReference" (
	"conversationId" uuid NOT NULL,
	"key" text NOT NULL,
	"ownerId" text NOT NULL,
	CONSTRAINT "EveFileReference_conversationId_key_pk" PRIMARY KEY("conversationId","key")
);
CREATE TABLE "EveGuest" (
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"messageLimit" integer NOT NULL,
	"ownerId" text PRIMARY KEY NOT NULL,
	"remainingMessages" integer NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	CONSTRAINT "EveGuest_tokenHash_unique" UNIQUE("tokenHash"),
	CONSTRAINT "EveGuest_message_balance" CHECK ("EveGuest"."remainingMessages" >= 0 and "EveGuest"."remainingMessages" <= "EveGuest"."messageLimit"),
	CONSTRAINT "EveGuest_token_hash" CHECK ("EveGuest"."tokenHash" ~ '^[0-9a-f]{64}$')
);
CREATE TABLE "EveGuestMessage" (
	"ipHash" varchar(64) NOT NULL,
	"operationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"requestHash" varchar(64) NOT NULL,
	"reservationId" uuid NOT NULL,
	"reservedAt" timestamp with time zone NOT NULL,
	"state" text NOT NULL,
	CONSTRAINT "EveGuestMessage_ownerId_operationId_pk" PRIMARY KEY("ownerId","operationId"),
	CONSTRAINT "EveGuestMessage_state" CHECK ("EveGuestMessage"."state" in ('reserved', 'committed', 'released')),
	CONSTRAINT "EveGuestMessage_request_hash" CHECK ("EveGuestMessage"."requestHash" ~ '^[0-9a-f]{64}$')
);
CREATE TABLE "EveGuestRate" (
	"ipHash" varchar(64) NOT NULL,
	"requests" integer NOT NULL,
	"startsAt" timestamp with time zone NOT NULL,
	"windowSeconds" integer NOT NULL,
	CONSTRAINT "EveGuestRate_ipHash_windowSeconds_startsAt_pk" PRIMARY KEY("ipHash","windowSeconds","startsAt"),
	CONSTRAINT "EveGuestRate_requests" CHECK ("EveGuestRate"."requests" >= 0),
	CONSTRAINT "EveGuestRate_window" CHECK ("EveGuestRate"."windowSeconds" in (60, 2592000))
);
CREATE TABLE "EveImportedDocumentCheckpoint" (
	"conversationId" uuid NOT NULL,
	"messageIndex" integer NOT NULL,
	"ownerId" text NOT NULL,
	CONSTRAINT "EveImportedDocumentCheckpoint_conversationId_messageIndex_pk" PRIMARY KEY("conversationId","messageIndex"),
	CONSTRAINT "EveImportedDocumentCheckpoint_message_range" CHECK ("EveImportedDocumentCheckpoint"."messageIndex" between 0 and 9999)
);
CREATE TABLE "EveImportedDocumentCheckpointEntry" (
	"conversationId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"messageIndex" integer NOT NULL,
	"ownerId" text NOT NULL,
	"revisionId" uuid NOT NULL,
	CONSTRAINT "EveImportedDocumentCheckpointEntry_conversationId_messageIndex_documentId_pk" PRIMARY KEY("conversationId","messageIndex","documentId")
);
CREATE TABLE "EveNamedDocumentCheckpoint" (
	"checkpointId" uuid NOT NULL,
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"turnIndex" integer NOT NULL,
	CONSTRAINT "EveNamedDocumentCheckpoint_conversationId_checkpointId_pk" PRIMARY KEY("conversationId","checkpointId"),
	CONSTRAINT "EveNamedDocumentCheckpoint_turn_nonnegative" CHECK ("EveNamedDocumentCheckpoint"."turnIndex" >= 0)
);
CREATE TABLE "EveNamedDocumentCheckpointEntry" (
	"checkpointId" uuid NOT NULL,
	"conversationId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"revisionId" uuid NOT NULL,
	CONSTRAINT "EveNamedDocumentCheckpointEntry_conversationId_checkpointId_documentId_pk" PRIMARY KEY("conversationId","checkpointId","documentId")
);
CREATE TABLE "EveResponseGroup" (
	"candidateOperationIds" uuid[] NOT NULL,
	"candidates" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inputHash" text,
	"operationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"sourceConversationId" uuid,
	"sourceIdentityKnown" boolean DEFAULT false NOT NULL
);
CREATE TABLE "EveStoredFile" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"key" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"state" text DEFAULT 'active' NOT NULL
);
CREATE TABLE "EveUsage" (
	"chargedCents" integer DEFAULT 0 NOT NULL,
	"costUsd" numeric(24, 12),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"eventId" text PRIMARY KEY NOT NULL,
	"generationId" text,
	"ownerId" text NOT NULL,
	"sessionId" text NOT NULL,
	"turnId" text NOT NULL
);
CREATE TABLE "EveVote" (
	"conversationId" uuid NOT NULL,
	"isUpvoted" boolean NOT NULL,
	"messageId" text NOT NULL,
	CONSTRAINT "EveVote_conversationId_messageId_pk" PRIMARY KEY("conversationId","messageId")
);
-- Composite foreign keys below depend on these unique identities.
CREATE UNIQUE INDEX "EveConversation_id_owner" ON "EveConversation" USING btree ("id","ownerId");
CREATE UNIQUE INDEX "EveConversationCopy_owner_identity" ON "EveConversationCopy" USING btree ("conversationId","ownerId");
CREATE UNIQUE INDEX "EveDocumentCheckpoint_owner_identity" ON "EveDocumentCheckpoint" USING btree ("conversationId","turnIndex","ownerId");
CREATE UNIQUE INDEX "EveDocumentRevision_identity" ON "EveDocumentRevision" USING btree ("id","documentId","ownerId");
CREATE UNIQUE INDEX "EveImportedDocumentCheckpoint_owner_identity" ON "EveImportedDocumentCheckpoint" USING btree ("conversationId","messageIndex","ownerId");
CREATE UNIQUE INDEX "EveNamedDocumentCheckpoint_owner_identity" ON "EveNamedDocumentCheckpoint" USING btree ("conversationId","checkpointId","ownerId");
CREATE UNIQUE INDEX "EveStoredFile_key_owner" ON "EveStoredFile" USING btree ("key","ownerId");
CREATE UNIQUE INDEX "Project_id_user_idx" ON "Project" USING btree ("id","userId");
ALTER TABLE "EveCodeSandbox" ADD CONSTRAINT "EveCodeSandbox_conversationId_ownerId_EveConversation_id_ownerId_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_parent_owner_fk" FOREIGN KEY ("parentConversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_root_owner_fk" FOREIGN KEY ("rootConversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveConversationCopy" ADD CONSTRAINT "EveConversationCopy_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveConversationCopyFile" ADD CONSTRAINT "EveConversationCopyFile_copy_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversationCopy"("conversationId","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveConversationProject" ADD CONSTRAINT "EveConversationProject_conversationId_ownerId_EveConversation_id_ownerId_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "EveConversationProject" ADD CONSTRAINT "EveConversationProject_projectId_ownerId_Project_id_userId_fk" FOREIGN KEY ("projectId","ownerId") REFERENCES "public"."Project"("id","userId") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "EveDocumentCheckpoint" ADD CONSTRAINT "EveDocumentCheckpoint_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveDocumentCheckpointEntry" ADD CONSTRAINT "EveDocumentCheckpointEntry_checkpoint_owner_fk" FOREIGN KEY ("conversationId","turnIndex","ownerId") REFERENCES "public"."EveDocumentCheckpoint"("conversationId","turnIndex","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveDocumentCheckpointEntry" ADD CONSTRAINT "EveDocumentCheckpointEntry_revision_owner_fk" FOREIGN KEY ("revisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveDocumentHead" ADD CONSTRAINT "EveDocumentHead_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveDocumentHead" ADD CONSTRAINT "EveDocumentHead_revision_document_owner_fk" FOREIGN KEY ("revisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveDocumentRevision" ADD CONSTRAINT "EveDocumentRevision_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveDocumentRevision" ADD CONSTRAINT "EveDocumentRevision_parent_document_owner_fk" FOREIGN KEY ("parentRevisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveFileReference" ADD CONSTRAINT "EveFileReference_conversationId_ownerId_EveConversation_id_ownerId_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveFileReference" ADD CONSTRAINT "EveFileReference_key_ownerId_EveStoredFile_key_ownerId_fk" FOREIGN KEY ("key","ownerId") REFERENCES "public"."EveStoredFile"("key","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveGuest" ADD CONSTRAINT "EveGuest_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "EveGuestMessage" ADD CONSTRAINT "EveGuestMessage_ownerId_EveGuest_ownerId_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."EveGuest"("ownerId") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "EveImportedDocumentCheckpoint" ADD CONSTRAINT "EveImportedDocumentCheckpoint_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveImportedDocumentCheckpointEntry" ADD CONSTRAINT "EveImportedDocumentCheckpointEntry_checkpoint_owner_fk" FOREIGN KEY ("conversationId","messageIndex","ownerId") REFERENCES "public"."EveImportedDocumentCheckpoint"("conversationId","messageIndex","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveImportedDocumentCheckpointEntry" ADD CONSTRAINT "EveImportedDocumentCheckpointEntry_revision_owner_fk" FOREIGN KEY ("revisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveNamedDocumentCheckpoint" ADD CONSTRAINT "EveNamedDocumentCheckpoint_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveNamedDocumentCheckpointEntry" ADD CONSTRAINT "EveNamedDocumentCheckpointEntry_checkpoint_owner_fk" FOREIGN KEY ("conversationId","checkpointId","ownerId") REFERENCES "public"."EveNamedDocumentCheckpoint"("conversationId","checkpointId","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveNamedDocumentCheckpointEntry" ADD CONSTRAINT "EveNamedDocumentCheckpointEntry_revision_owner_fk" FOREIGN KEY ("revisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveResponseGroup" ADD CONSTRAINT "EveResponseGroup_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveStoredFile" ADD CONSTRAINT "EveStoredFile_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveUsage" ADD CONSTRAINT "EveUsage_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "EveVote" ADD CONSTRAINT "EveVote_conversationId_EveConversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."EveConversation"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "EveCodeSandbox_conversation" ON "EveCodeSandbox" USING btree ("conversationId");
CREATE INDEX "EveConversation_owner_root" ON "EveConversation" USING btree ("ownerId","rootConversationId");
CREATE UNIQUE INDEX "EveConversation_owner_operation" ON "EveConversation" USING btree ("ownerId","operationId");
CREATE INDEX "EveConversationProject_project" ON "EveConversationProject" USING btree ("projectId");
CREATE UNIQUE INDEX "EveDocumentRevision_operation" ON "EveDocumentRevision" USING btree ("conversationId","operationId");
CREATE INDEX "EveFileReference_key" ON "EveFileReference" USING btree ("key");
CREATE INDEX "EveGuest_expiry_idx" ON "EveGuest" USING btree ("expiresAt");
CREATE UNIQUE INDEX "EveResponseGroup_owner_operation" ON "EveResponseGroup" USING btree ("ownerId","operationId");
CREATE INDEX "EveStoredFile_owner" ON "EveStoredFile" USING btree ("ownerId");
CREATE INDEX "EveUsage_session_turn" ON "EveUsage" USING btree ("sessionId","turnId");

END;
$eve_runtime$;
