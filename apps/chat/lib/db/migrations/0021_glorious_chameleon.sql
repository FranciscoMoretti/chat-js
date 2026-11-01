ALTER TABLE "EveGuest" DROP CONSTRAINT "EveGuest_message_balance";--> statement-breakpoint
ALTER TABLE "GuestRuntimeSession" DROP CONSTRAINT "GuestRuntimeSession_balance";--> statement-breakpoint
ALTER TABLE "EveGuest" DROP COLUMN "messageLimit";--> statement-breakpoint
ALTER TABLE "EveGuest" DROP COLUMN "remainingMessages";--> statement-breakpoint
ALTER TABLE "GuestRuntimeSession" DROP COLUMN "messageLimit";--> statement-breakpoint
ALTER TABLE "GuestRuntimeSession" DROP COLUMN "messagesUsed";