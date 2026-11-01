CREATE TABLE "GuestRuntimeRate" (
	"ipHash" text NOT NULL,
	"kind" text NOT NULL,
	"startsAt" timestamp with time zone NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "GuestRuntimeRate_ipHash_kind_startsAt_pk" PRIMARY KEY("ipHash","kind","startsAt"),
	CONSTRAINT "GuestRuntimeRate_requests" CHECK ("GuestRuntimeRate"."requests" >= 0),
	CONSTRAINT "GuestRuntimeRate_kind" CHECK ("GuestRuntimeRate"."kind" in ('session', 'message'))
);
--> statement-breakpoint
CREATE TABLE "GuestRuntimeSession" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ownerId" text NOT NULL,
	"sessionId" text,
	"modelId" text NOT NULL,
	"ipHash" text NOT NULL,
	"policyVersion" integer DEFAULT 1 NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone DEFAULT now() + interval '24 hours' NOT NULL,
	"credentialExpiresAt" timestamp with time zone NOT NULL,
	"messageLimit" integer NOT NULL,
	"messagesUsed" integer DEFAULT 0 NOT NULL,
	"cleanupAttemptedAt" timestamp with time zone,
	"deletedAt" timestamp with time zone,
	CONSTRAINT "GuestRuntimeSession_ownerId_unique" UNIQUE("ownerId"),
	CONSTRAINT "GuestRuntimeSession_sessionId_unique" UNIQUE("sessionId"),
	CONSTRAINT "GuestRuntimeSession_state" CHECK ("GuestRuntimeSession"."state" in ('active', 'deleting', 'deleted')),
	CONSTRAINT "GuestRuntimeSession_balance" CHECK ("GuestRuntimeSession"."messagesUsed" >= 0 and "GuestRuntimeSession"."messagesUsed" <= "GuestRuntimeSession"."messageLimit"),
	CONSTRAINT "GuestRuntimeSession_ip_hash" CHECK ("GuestRuntimeSession"."ipHash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "GuestRuntimeSession_expiry" CHECK ("GuestRuntimeSession"."expiresAt" = "GuestRuntimeSession"."createdAt" + interval '24 hours')
);
--> statement-breakpoint
CREATE INDEX "GuestRuntimeSession_cleanup_idx" ON "GuestRuntimeSession" USING btree ("state","expiresAt");