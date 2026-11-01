-- Retire the former account-shaped guest tables only after their native payloads
-- have been purged by the previous release. Never discard live cleanup ownership.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "EveGuest" g
    JOIN "EveConversation" c ON c."ownerId" = g."ownerId"
    WHERE c.state <> 'deleted'
  ) THEN
    RAISE EXCEPTION 'Purge legacy guest conversations with the previous release before applying migration 0022';
  END IF;
END $$;
--> statement-breakpoint
DROP TABLE "EveGuest" CASCADE;--> statement-breakpoint
DROP TABLE "EveGuestMessage" CASCADE;--> statement-breakpoint
DROP TABLE "EveGuestRate" CASCADE;--> statement-breakpoint
ALTER TABLE "EveConversation" DROP COLUMN "guestCleanupAttemptedAt";