CREATE TABLE "EveGuest" (
	"ownerId" text PRIMARY KEY NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"messageLimit" integer NOT NULL,
	"remainingMessages" integer NOT NULL,
	CONSTRAINT "EveGuest_tokenHash_unique" UNIQUE("tokenHash"),
	CONSTRAINT "EveGuest_message_balance" CHECK ("EveGuest"."remainingMessages" >= 0 and "EveGuest"."remainingMessages" <= "EveGuest"."messageLimit"),
	CONSTRAINT "EveGuest_token_hash" CHECK ("EveGuest"."tokenHash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "EveGuestMessage" (
	"ownerId" text NOT NULL,
	"operationId" uuid NOT NULL,
	"requestHash" varchar(64) NOT NULL,
	"reservationId" uuid NOT NULL,
	"ipHash" varchar(64) NOT NULL,
	"state" text NOT NULL,
	"reservedAt" timestamp with time zone NOT NULL,
	CONSTRAINT "EveGuestMessage_ownerId_operationId_pk" PRIMARY KEY("ownerId","operationId"),
	CONSTRAINT "EveGuestMessage_state" CHECK ("EveGuestMessage"."state" in ('reserved', 'committed', 'released')),
	CONSTRAINT "EveGuestMessage_request_hash" CHECK ("EveGuestMessage"."requestHash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "EveGuestRate" (
	"ipHash" varchar(64) NOT NULL,
	"windowSeconds" integer NOT NULL,
	"startsAt" timestamp with time zone NOT NULL,
	"requests" integer NOT NULL,
	CONSTRAINT "EveGuestRate_ipHash_windowSeconds_startsAt_pk" PRIMARY KEY("ipHash","windowSeconds","startsAt"),
	CONSTRAINT "EveGuestRate_requests" CHECK ("EveGuestRate"."requests" >= 0),
	CONSTRAINT "EveGuestRate_window" CHECK ("EveGuestRate"."windowSeconds" in (60, 2592000))
);
--> statement-breakpoint
ALTER TABLE "EveGuest" ADD CONSTRAINT "EveGuest_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "EveGuestMessage" ADD CONSTRAINT "EveGuestMessage_ownerId_EveGuest_ownerId_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."EveGuest"("ownerId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "EveGuest_expiry_idx" ON "EveGuest" USING btree ("expiresAt");