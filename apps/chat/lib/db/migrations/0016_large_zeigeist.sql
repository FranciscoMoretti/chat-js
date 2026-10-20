CREATE TABLE "EvePersistentSandbox" (
	"name" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"providerId" text NOT NULL,
	"accountId" text NOT NULL,
	"scopeId" text NOT NULL,
	"state" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EveSandboxSession" (
	"sessionId" text PRIMARY KEY NOT NULL,
	"rootSessionId" text NOT NULL,
	"ownerId" text NOT NULL,
	"devRunId" text,
	"state" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "EvePersistentSandbox" ADD CONSTRAINT "EvePersistentSandbox_sessionId_EveSandboxSession_sessionId_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."EveSandboxSession"("sessionId") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "EvePersistentSandbox_session" ON "EvePersistentSandbox" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "EveSandboxSession_root" ON "EveSandboxSession" USING btree ("rootSessionId");--> statement-breakpoint
CREATE INDEX "EveSandboxSession_dev" ON "EveSandboxSession" USING btree ("devRunId");