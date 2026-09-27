-- Opt-in recovery ONLY for the unreleased a84b363c search preview.
-- Stop the preview app/EVE writer and back up the database before running.
-- This discards only the rebuildable search projection, never EVE transcripts.
-- Afterward run db:migrate, deploy the current runtime, and run search:backfill.
BEGIN;
LOCK TABLE drizzle.__drizzle_migrations IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF (SELECT count(*) FROM drizzle.__drizzle_migrations) <> 3
     OR EXISTS (
       SELECT 1 FROM drizzle.__drizzle_migrations
       WHERE (created_at, hash) NOT IN (
         (1789411557764, '15b3b04ac463834f43956c941d27cc1793a91d980a72bd5ccaf4a3f4a9005f11'),
         (1789979176755, 'f73c02e8b9a49193eb571e710e097b58a9772722f1f6d4bea46766106cc09312'),
         (1790327870855, '7e6be9466a37bdfe7d71ed3ccfbae93c26e50b31f80314b49a2ad298c6f6ab60')
       )
     )
     OR (SELECT count(DISTINCT created_at) FROM drizzle.__drizzle_migrations) <> 3
  THEN
    RAISE EXCEPTION 'Not the known unreleased search-preview migration history; no changes made.';
  END IF;
  DROP TABLE "EveSearchText";
  DELETE FROM drizzle.__drizzle_migrations
    WHERE created_at = 1790327870855
      AND hash = '7e6be9466a37bdfe7d71ed3ccfbae93c26e50b31f80314b49a2ad298c6f6ab60';
END $$;
COMMIT;
