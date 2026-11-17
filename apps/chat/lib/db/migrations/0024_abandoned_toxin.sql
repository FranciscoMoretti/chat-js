CREATE TABLE "SlackConversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" text NOT NULL,
	"channelId" text NOT NULL,
	"threadTs" text NOT NULL,
	"direct" boolean NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "SlackConversation_team_thread" UNIQUE("teamId","channelId","threadTs"),
	CONSTRAINT "SlackConversation_id_team" UNIQUE("id","teamId"),
	CONSTRAINT "SlackConversation_native_address" UNIQUE("channelId","threadTs")
);
--> statement-breakpoint
CREATE TABLE "SlackDocument" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversationId" uuid NOT NULL,
	"teamId" text NOT NULL,
	"creatorId" text NOT NULL,
	"headRevisionId" uuid,
	CONSTRAINT "SlackDocument_id_conversation_team" UNIQUE("id","conversationId","teamId")
);
--> statement-breakpoint
CREATE TABLE "SlackDocumentRevision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"conversationId" uuid NOT NULL,
	"teamId" text NOT NULL,
	"actorId" text NOT NULL,
	"operationId" text NOT NULL,
	"requestHash" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"fileIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "SlackDocumentRevision_operation" UNIQUE("conversationId","operationId")
);
--> statement-breakpoint
CREATE TABLE "SlackSession" (
	"sessionId" text PRIMARY KEY NOT NULL,
	"conversationId" uuid NOT NULL,
	"teamId" text NOT NULL,
	"rootSessionId" text NOT NULL,
	"rootTurnId" text,
	CONSTRAINT "SlackSession_id_team" UNIQUE("sessionId","teamId")
);
--> statement-breakpoint
CREATE TABLE "SlackUsage" (
	"eventId" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"teamId" text NOT NULL,
	"actorId" text NOT NULL,
	"rootSessionId" text NOT NULL,
	"turnId" text NOT NULL,
	"kind" text NOT NULL,
	"modelId" text,
	"costUsd" double precision,
	"settled" boolean DEFAULT false NOT NULL,
	"inputTokens" integer,
	"outputTokens" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "SlackDocument" ADD CONSTRAINT "SlackDocument_conversationId_teamId_SlackConversation_id_teamId_fk" FOREIGN KEY ("conversationId","teamId") REFERENCES "public"."SlackConversation"("id","teamId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SlackDocumentRevision" ADD CONSTRAINT "SlackDocumentRevision_documentId_conversationId_teamId_SlackDocument_id_conversationId_teamId_fk" FOREIGN KEY ("documentId","conversationId","teamId") REFERENCES "public"."SlackDocument"("id","conversationId","teamId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SlackSession" ADD CONSTRAINT "SlackSession_conversationId_teamId_SlackConversation_id_teamId_fk" FOREIGN KEY ("conversationId","teamId") REFERENCES "public"."SlackConversation"("id","teamId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SlackUsage" ADD CONSTRAINT "SlackUsage_sessionId_teamId_SlackSession_sessionId_teamId_fk" FOREIGN KEY ("sessionId","teamId") REFERENCES "public"."SlackSession"("sessionId","teamId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "SlackUsage_workspace_date" ON "SlackUsage" USING btree ("teamId","createdAt");