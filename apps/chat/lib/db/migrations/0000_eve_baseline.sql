CREATE TABLE "account" (
	"access_token" text,
	"access_token_expires_at" timestamp,
	"account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"updated_at" timestamp NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EveChat" (
	"activeConversationId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isPinned" boolean DEFAULT false NOT NULL,
	"ownerId" text NOT NULL,
	"title" text NOT NULL,
	"titleStatus" text DEFAULT 'pending' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "EveChat_id_owner" UNIQUE("id","ownerId"),
	CONSTRAINT "EveChat_title_status" CHECK ("EveChat"."titleStatus" in ('pending', 'fallback', 'generated', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "EveChatProject" (
	"chatId" uuid PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"projectId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EveCodeSandbox" (
	"callId" text NOT NULL,
	"conversationId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"creationConfirmed" boolean DEFAULT false NOT NULL,
	"name" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"state" text DEFAULT 'unresolved' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EveConversation" (
	"chatId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"creationKind" text DEFAULT 'message' NOT NULL,
	"firstMessage" text NOT NULL,
	"forkCheckpointId" uuid,
	"forkKind" text,
	"forkMessageId" text,
	"forkTurnId" text,
	"guestCleanupAttemptedAt" timestamp with time zone,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"initialContentHash" text,
	"initialModelId" text,
	"initialProjectId" uuid,
	"operationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"parentConversationId" uuid,
	"rootConversationId" uuid,
	"sessionId" text,
	"state" text DEFAULT 'creating' NOT NULL,
	"usageStreamIndex" integer DEFAULT 0 NOT NULL,
	"visibility" varchar DEFAULT 'private' NOT NULL,
	CONSTRAINT "EveConversation_sessionId_unique" UNIQUE("sessionId"),
	CONSTRAINT "EveConversation_id_owner" UNIQUE("id","ownerId"),
	CONSTRAINT "EveConversation_id_owner_chat" UNIQUE("id","ownerId","chatId"),
	CONSTRAINT "EveConversation_creation_kind" CHECK ("EveConversation"."creationKind" in ('message', 'copy')),
	CONSTRAINT "EveConversation_copy_root" CHECK ("EveConversation"."creationKind" <> 'copy' or (
      "EveConversation"."parentConversationId" is null and "EveConversation"."rootConversationId" is null and
      "EveConversation"."forkTurnId" is null and "EveConversation"."forkMessageId" is null and "EveConversation"."forkCheckpointId" is null and
      "EveConversation"."forkKind" is null
    )),
	CONSTRAINT "EveConversation_named_fork_shape" CHECK ("EveConversation"."forkCheckpointId" is null or (
      "EveConversation"."parentConversationId" is not null and "EveConversation"."forkMessageId" is null
    )),
	CONSTRAINT "EveConversation_fork_shape" CHECK ((
      "EveConversation"."parentConversationId" is null and "EveConversation"."rootConversationId" is null and
      "EveConversation"."forkTurnId" is null and "EveConversation"."forkMessageId" is null and "EveConversation"."forkKind" is null
    ) or (
      "EveConversation"."parentConversationId" is not null and "EveConversation"."rootConversationId" is not null and
      (
        ("EveConversation"."forkTurnId" is not null and "EveConversation"."forkTurnId" ~ '^turn_(0|[1-9][0-9]*)$' and "EveConversation"."forkMessageId" is null) or
        ("EveConversation"."forkMessageId" is not null and "EveConversation"."forkMessageId" ~ '^seed_message_(0|[1-9][0-9]{0,3})$' and "EveConversation"."forkTurnId" is null)
      ) and
      "EveConversation"."parentConversationId" <> "EveConversation"."id" and "EveConversation"."rootConversationId" <> "EveConversation"."id"
    )),
	CONSTRAINT "EveConversation_fork_kind" CHECK ("EveConversation"."forkKind" is null or "EveConversation"."forkKind" in ('edit', 'regenerate', 'comparison'))
);
--> statement-breakpoint
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
	CONSTRAINT "EveConversationCopy_owner_identity" UNIQUE("conversationId","ownerId"),
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
--> statement-breakpoint
CREATE TABLE "EveDocumentCheckpoint" (
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"turnIndex" integer NOT NULL,
	CONSTRAINT "EveDocumentCheckpoint_conversationId_turnIndex_pk" PRIMARY KEY("conversationId","turnIndex"),
	CONSTRAINT "EveDocumentCheckpoint_owner_identity" UNIQUE("conversationId","turnIndex","ownerId"),
	CONSTRAINT "EveDocumentCheckpoint_turn_nonnegative" CHECK ("EveDocumentCheckpoint"."turnIndex" >= 0)
);
--> statement-breakpoint
CREATE TABLE "EveDocumentCheckpointEntry" (
	"conversationId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"revisionId" uuid NOT NULL,
	"turnIndex" integer NOT NULL,
	CONSTRAINT "EveDocumentCheckpointEntry_conversationId_turnIndex_documentId_pk" PRIMARY KEY("conversationId","turnIndex","documentId")
);
--> statement-breakpoint
CREATE TABLE "EveDocumentHead" (
	"conversationId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"revisionId" uuid NOT NULL,
	CONSTRAINT "EveDocumentHead_conversationId_documentId_pk" PRIMARY KEY("conversationId","documentId")
);
--> statement-breakpoint
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
	CONSTRAINT "EveDocumentRevision_identity" UNIQUE("id","documentId","ownerId"),
	CONSTRAINT "EveDocumentRevision_turn_nonnegative" CHECK ("EveDocumentRevision"."turnIndex" >= 0)
);
--> statement-breakpoint
CREATE TABLE "EveFileReference" (
	"conversationId" uuid NOT NULL,
	"key" text NOT NULL,
	"ownerId" text NOT NULL,
	CONSTRAINT "EveFileReference_conversationId_key_pk" PRIMARY KEY("conversationId","key")
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "EveGuestRate" (
	"ipHash" varchar(64) NOT NULL,
	"requests" integer NOT NULL,
	"startsAt" timestamp with time zone NOT NULL,
	"windowSeconds" integer NOT NULL,
	CONSTRAINT "EveGuestRate_ipHash_windowSeconds_startsAt_pk" PRIMARY KEY("ipHash","windowSeconds","startsAt"),
	CONSTRAINT "EveGuestRate_requests" CHECK ("EveGuestRate"."requests" >= 0),
	CONSTRAINT "EveGuestRate_window" CHECK ("EveGuestRate"."windowSeconds" in (60, 2592000))
);
--> statement-breakpoint
CREATE TABLE "EveImportedDocumentCheckpoint" (
	"conversationId" uuid NOT NULL,
	"messageIndex" integer NOT NULL,
	"ownerId" text NOT NULL,
	CONSTRAINT "EveImportedDocumentCheckpoint_conversationId_messageIndex_pk" PRIMARY KEY("conversationId","messageIndex"),
	CONSTRAINT "EveImportedDocumentCheckpoint_owner_identity" UNIQUE("conversationId","messageIndex","ownerId"),
	CONSTRAINT "EveImportedDocumentCheckpoint_message_range" CHECK ("EveImportedDocumentCheckpoint"."messageIndex" between 0 and 9999)
);
--> statement-breakpoint
CREATE TABLE "EveImportedDocumentCheckpointEntry" (
	"conversationId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"messageIndex" integer NOT NULL,
	"ownerId" text NOT NULL,
	"revisionId" uuid NOT NULL,
	CONSTRAINT "EveImportedDocumentCheckpointEntry_conversationId_messageIndex_documentId_pk" PRIMARY KEY("conversationId","messageIndex","documentId")
);
--> statement-breakpoint
CREATE TABLE "EveNamedDocumentCheckpoint" (
	"checkpointId" uuid NOT NULL,
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"turnIndex" integer NOT NULL,
	CONSTRAINT "EveNamedDocumentCheckpoint_conversationId_checkpointId_pk" PRIMARY KEY("conversationId","checkpointId"),
	CONSTRAINT "EveNamedDocumentCheckpoint_owner_identity" UNIQUE("conversationId","checkpointId","ownerId"),
	CONSTRAINT "EveNamedDocumentCheckpoint_turn_nonnegative" CHECK ("EveNamedDocumentCheckpoint"."turnIndex" >= 0)
);
--> statement-breakpoint
CREATE TABLE "EveNamedDocumentCheckpointEntry" (
	"checkpointId" uuid NOT NULL,
	"conversationId" uuid NOT NULL,
	"documentId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"revisionId" uuid NOT NULL,
	CONSTRAINT "EveNamedDocumentCheckpointEntry_conversationId_checkpointId_documentId_pk" PRIMARY KEY("conversationId","checkpointId","documentId")
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "EveStoredFile" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"key" text PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "EveStoredFile_key_owner" UNIQUE("key","ownerId")
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "EveVote" (
	"conversationId" uuid NOT NULL,
	"isUpvoted" boolean NOT NULL,
	"messageId" text NOT NULL,
	CONSTRAINT "EveVote_conversationId_messageId_pk" PRIMARY KEY("conversationId","messageId")
);
--> statement-breakpoint
CREATE TABLE "McpConnector" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"nameId" varchar(256) NOT NULL,
	"oauthClientId" text,
	"oauthClientSecret" text,
	"type" varchar DEFAULT 'http' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"url" text NOT NULL,
	"userId" text
);
--> statement-breakpoint
CREATE TABLE "McpOAuthSession" (
	"clientInfo" text,
	"codeVerifier" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mcpConnectorId" uuid NOT NULL,
	"serverUrl" text NOT NULL,
	"state" text,
	"tokens" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "McpOAuthSession_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "Project" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"icon" varchar(64) DEFAULT 'folder' NOT NULL,
	"iconColor" varchar(32) DEFAULT 'gray' NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "Project_id_user" UNIQUE("id","userId")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"ip_address" text,
	"token" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"name" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "UserCredit" (
	"credits" integer DEFAULT 50 NOT NULL,
	"userId" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserModelPreference" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"enabled" boolean NOT NULL,
	"modelId" varchar(256) NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "UserModelPreference_userId_modelId_pk" PRIMARY KEY("userId","modelId")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveChat" ADD CONSTRAINT "EveChat_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveChatProject" ADD CONSTRAINT "EveChatProject_chatId_ownerId_EveChat_id_ownerId_fk" FOREIGN KEY ("chatId","ownerId") REFERENCES "public"."EveChat"("id","ownerId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveChatProject" ADD CONSTRAINT "EveChatProject_projectId_ownerId_Project_id_userId_fk" FOREIGN KEY ("projectId","ownerId") REFERENCES "public"."Project"("id","userId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveCodeSandbox" ADD CONSTRAINT "EveCodeSandbox_conversationId_ownerId_EveConversation_id_ownerId_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_chat_owner_fk" FOREIGN KEY ("chatId","ownerId") REFERENCES "public"."EveChat"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_parent_owner_fk" FOREIGN KEY ("parentConversationId","ownerId","chatId") REFERENCES "public"."EveConversation"("id","ownerId","chatId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_root_owner_fk" FOREIGN KEY ("rootConversationId","ownerId","chatId") REFERENCES "public"."EveConversation"("id","ownerId","chatId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveConversationCopy" ADD CONSTRAINT "EveConversationCopy_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveConversationCopyFile" ADD CONSTRAINT "EveConversationCopyFile_copy_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversationCopy"("conversationId","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveDocumentCheckpoint" ADD CONSTRAINT "EveDocumentCheckpoint_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveDocumentCheckpointEntry" ADD CONSTRAINT "EveDocumentCheckpointEntry_checkpoint_owner_fk" FOREIGN KEY ("conversationId","turnIndex","ownerId") REFERENCES "public"."EveDocumentCheckpoint"("conversationId","turnIndex","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveDocumentCheckpointEntry" ADD CONSTRAINT "EveDocumentCheckpointEntry_revision_owner_fk" FOREIGN KEY ("revisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveDocumentHead" ADD CONSTRAINT "EveDocumentHead_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveDocumentHead" ADD CONSTRAINT "EveDocumentHead_revision_document_owner_fk" FOREIGN KEY ("revisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveDocumentRevision" ADD CONSTRAINT "EveDocumentRevision_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveDocumentRevision" ADD CONSTRAINT "EveDocumentRevision_parent_document_owner_fk" FOREIGN KEY ("parentRevisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveFileReference" ADD CONSTRAINT "EveFileReference_conversationId_ownerId_EveConversation_id_ownerId_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveFileReference" ADD CONSTRAINT "EveFileReference_key_ownerId_EveStoredFile_key_ownerId_fk" FOREIGN KEY ("key","ownerId") REFERENCES "public"."EveStoredFile"("key","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveGuest" ADD CONSTRAINT "EveGuest_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveGuestMessage" ADD CONSTRAINT "EveGuestMessage_ownerId_EveGuest_ownerId_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."EveGuest"("ownerId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveImportedDocumentCheckpoint" ADD CONSTRAINT "EveImportedDocumentCheckpoint_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveImportedDocumentCheckpointEntry" ADD CONSTRAINT "EveImportedDocumentCheckpointEntry_checkpoint_owner_fk" FOREIGN KEY ("conversationId","messageIndex","ownerId") REFERENCES "public"."EveImportedDocumentCheckpoint"("conversationId","messageIndex","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveImportedDocumentCheckpointEntry" ADD CONSTRAINT "EveImportedDocumentCheckpointEntry_revision_owner_fk" FOREIGN KEY ("revisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveNamedDocumentCheckpoint" ADD CONSTRAINT "EveNamedDocumentCheckpoint_conversation_owner_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveNamedDocumentCheckpointEntry" ADD CONSTRAINT "EveNamedDocumentCheckpointEntry_checkpoint_owner_fk" FOREIGN KEY ("conversationId","checkpointId","ownerId") REFERENCES "public"."EveNamedDocumentCheckpoint"("conversationId","checkpointId","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveNamedDocumentCheckpointEntry" ADD CONSTRAINT "EveNamedDocumentCheckpointEntry_revision_owner_fk" FOREIGN KEY ("revisionId","documentId","ownerId") REFERENCES "public"."EveDocumentRevision"("id","documentId","ownerId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveResponseGroup" ADD CONSTRAINT "EveResponseGroup_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveStoredFile" ADD CONSTRAINT "EveStoredFile_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveUsage" ADD CONSTRAINT "EveUsage_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveVote" ADD CONSTRAINT "EveVote_conversationId_EveConversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."EveConversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "McpConnector" ADD CONSTRAINT "McpConnector_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "McpOAuthSession" ADD CONSTRAINT "McpOAuthSession_mcpConnectorId_McpConnector_id_fk" FOREIGN KEY ("mcpConnectorId") REFERENCES "public"."McpConnector"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserCredit" ADD CONSTRAINT "UserCredit_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserModelPreference" ADD CONSTRAINT "UserModelPreference_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "EveChat_owner_activity" ON "EveChat" USING btree ("ownerId","isPinned","updatedAt");--> statement-breakpoint
CREATE INDEX "EveChatProject_project" ON "EveChatProject" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "EveCodeSandbox_conversation" ON "EveCodeSandbox" USING btree ("conversationId");--> statement-breakpoint
CREATE INDEX "EveConversation_owner_chat" ON "EveConversation" USING btree ("ownerId","chatId");--> statement-breakpoint
CREATE INDEX "EveConversation_owner_root" ON "EveConversation" USING btree ("ownerId","rootConversationId");--> statement-breakpoint
CREATE UNIQUE INDEX "EveConversation_owner_operation" ON "EveConversation" USING btree ("ownerId","operationId");--> statement-breakpoint
CREATE UNIQUE INDEX "EveDocumentRevision_operation" ON "EveDocumentRevision" USING btree ("conversationId","operationId");--> statement-breakpoint
CREATE INDEX "EveFileReference_key" ON "EveFileReference" USING btree ("key");--> statement-breakpoint
CREATE INDEX "EveGuest_expiry_idx" ON "EveGuest" USING btree ("expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "EveResponseGroup_owner_operation" ON "EveResponseGroup" USING btree ("ownerId","operationId");--> statement-breakpoint
CREATE INDEX "EveStoredFile_owner" ON "EveStoredFile" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "EveUsage_session_turn" ON "EveUsage" USING btree ("sessionId","turnId");--> statement-breakpoint
CREATE INDEX "McpConnector_user_id_idx" ON "McpConnector" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "McpConnector_user_name_id_idx" ON "McpConnector" USING btree ("userId","nameId");--> statement-breakpoint
CREATE UNIQUE INDEX "McpConnector_user_name_id_unique" ON "McpConnector" USING btree ("userId","nameId");--> statement-breakpoint
CREATE INDEX "McpOAuthSession_connector_idx" ON "McpOAuthSession" USING btree ("mcpConnectorId");--> statement-breakpoint
CREATE INDEX "McpOAuthSession_state_idx" ON "McpOAuthSession" USING btree ("state");--> statement-breakpoint
CREATE INDEX "Project_user_id_idx" ON "Project" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "UserModelPreference_user_id_idx" ON "UserModelPreference" USING btree ("userId");